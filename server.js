// server.js
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIG & DB ---
// Підключення до MongoDB (локально)
mongoose.connect('mongodb://localhost:27017/seismic_vanilla')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.warn('⚠️ MongoDB Error (Using fallback mode without DB cache):', err.message));

// Схема даних (NoSQL)
const QuakeSchema = new mongoose.Schema({
    usgsId: { type: String, unique: true },
    mag: Number,
    place: String,
    time: Number,
    depth: Number,
    coordinates: [Number] // [lon, lat]
});
const Quake = mongoose.model('Quake', QuakeSchema);

// --- RISK ENGINE (Логіка аналізу) ---
function calculateRisk(quake, userLat, userLon) {
    // Якщо координати користувача не передані — ризик 0
    if (!userLat || !userLon) return { score: 0, level: 'N/A', distance: 0 };

    const R = 6371; // Радіус Землі
    const dLat = (userLat - quake.coordinates[1]) * Math.PI / 180;
    const dLon = (userLon - quake.coordinates[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(quake.coordinates[1] * Math.PI / 180) * Math.cos(userLat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;

    // ФОРМУЛА РИЗИКУ
    // 1. Магнітуда: експоненційний вплив.
    // 2. Глибина і Відстань: зменшують вплив.
    const intensity = Math.pow(10, quake.mag - 4.5); // Базова інтенсивність
    const attenuation = (distanceKm / 10) + (quake.depth / 5) + 1; // Затухання
    
    let score = (intensity / attenuation) * 100;
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    let level = 'Low';
    if (score > 30) level = 'Medium';
    if (score > 70) level = 'High';

    return {
        score: Math.round(score),
        distance: Math.round(distanceKm),
        level
    };
}

// --- DATA INGESTION ---
async function fetchUSGSData() {
    try {
        const res = await axios.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
        const operations = res.data.features.map(f => ({
            updateOne: {
                filter: { usgsId: f.id },
                update: {
                    usgsId: f.id,
                    mag: f.properties.mag,
                    place: f.properties.place,
                    time: f.properties.time,
                    depth: f.geometry.coordinates[2],
                    coordinates: [f.geometry.coordinates[0], f.geometry.coordinates[1]]
                },
                upsert: true
            }
        }));
        
        // Якщо база підключена - пишемо в неї
        if (mongoose.connection.readyState === 1) {
            await Quake.bulkWrite(operations);
            console.log(`🔄 Synced ${operations.length} quakes to DB.`);
        }
        return operations.map(op => op.updateOne.update); // Повертаємо дані для fallback
    } catch (e) {
        console.error('API Fetch Error:', e.message);
        return [];
    }
}

// Оновлюємо дані кожні 5 хв
setInterval(fetchUSGSData, 5 * 60 * 1000);

// --- ROUTES ---

// Головна сторінка
app.use(express.static('public'));

// API Endpoint
app.get('/api/quakes', async (req, res) => {
    const { lat, lon, minMag } = req.query;
    let quakes = [];

    // 1. Отримуємо дані (з БД або напряму, якщо БД лежить)
    if (mongoose.connection.readyState === 1) {
        quakes = await Quake.find({ mag: { $gte: minMag || 0 } }).lean();
    } else {
        quakes = await fetchUSGSData(); // Fallback: live fetch
        if (minMag) quakes = quakes.filter(q => q.mag >= minMag);
    }

    // 2. Рахуємо ризик для кожного землетрусу відносно юзера
    const analyzed = quakes.map(q => {
        const risk = calculateRisk(q, parseFloat(lat), parseFloat(lon));
        return { ...q, risk };
    });

    // 3. Сортуємо: спочатку небезпечні, потім нові
    analyzed.sort((a, b) => b.risk.score - a.risk.score || b.time - a.time);

    res.json(analyzed);
});

// Start
fetchUSGSData().then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
});