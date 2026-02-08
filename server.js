const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// --- DB CONNECTION ---
mongoose.connect('mongodb://localhost:27017/seismic_risk_final')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(() => console.log('⚠️ Running in Memory Mode (No DB)'));

// --- SCHEMA ---
const QuakeSchema = new mongoose.Schema({
    usgsId: { type: String, unique: true },
    mag: Number,
    place: String,
    time: Number,
    depth: Number,
    coordinates: [Number],
    casualties: { type: Number, default: 0 },
    isUserReported: { type: Boolean, default: false }
});
const Quake = mongoose.model('Quake', QuakeSchema);

let memoryQuakes = [];

// --- API ---

app.get('/api/quakes', async (req, res) => {
    const { lat, lon, minMag } = req.query;
    const minM = parseFloat(minMag) || 0;
    
    let quakes = [];

    if (mongoose.connection.readyState === 1) {
        quakes = await Quake.find({ mag: { $gte: minM } }).lean();
    } else {
        const usgs = await fetchUSGSData();
        // Об'єднуємо і фільтруємо
        quakes = [...memoryQuakes, ...usgs].filter(q => q.mag >= minM);
    }

    const analyzed = quakes.map(q => ({
        ...q,
        risk: calculateRisk(q, parseFloat(lat), parseFloat(lon))
    }));

    res.json(analyzed);
});

app.post('/api/quakes', async (req, res) => {
    try {
        const { mag, place, depth, lat, lng, casualties } = req.body;
        
        const newQuake = {
            usgsId: 'user_' + Date.now(), // Унікальний ID
            mag: parseFloat(mag),
            place: place || "User Reported Event",
            time: Date.now(),
            depth: parseFloat(depth),
            coordinates: [parseFloat(lng), parseFloat(lat)],
            casualties: parseInt(casualties) || 0,
            isUserReported: true
        };

        if (mongoose.connection.readyState === 1) {
            await Quake.create(newQuake);
        } else {
            memoryQuakes.push(newQuake);
        }
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 🔥 НОВИЙ РОУТ ДЛЯ ВИДАЛЕННЯ 🔥
app.delete('/api/quakes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        if (mongoose.connection.readyState === 1) {
            await Quake.deleteOne({ usgsId: id });
        } else {
            memoryQuakes = memoryQuakes.filter(q => q.usgsId !== id);
        }
        console.log("🗑️ Deleted event:", id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- HELPERS ---
function calculateRisk(q, uLat, uLon) {
    if (!uLat || !uLon) return { distance: 0 };
    const R = 6371;
    const dLat = (uLat - q.coordinates[1]) * Math.PI / 180;
    const dLon = (uLon - q.coordinates[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(q.coordinates[1]*Math.PI/180)*Math.cos(uLat*Math.PI/180)*Math.sin(dLon/2)**2;
    return { distance: Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))) };
}

async function fetchUSGSData() {
    try {
        const res = await axios.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
        return res.data.features.map(f => ({
            usgsId: f.id,
            mag: f.properties.mag,
            place: f.properties.place,
            time: f.properties.time,
            depth: f.geometry.coordinates[2],
            coordinates: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
            casualties: 0,
            isUserReported: false
        }));
    } catch (e) { return []; }
}

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));