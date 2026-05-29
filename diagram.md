graph TD
    %% Стилізація вузлів
    classDef external fill:#f9f,stroke:#333,stroke-width:2px,color:black;
    classDef db fill:#ff9,stroke:#333,stroke-width:2px,color:black;
    classDef server fill:#9f9,stroke:#333,stroke-width:2px,color:black;
    classDef client fill:#9bf,stroke:#333,stroke-width:2px,color:black;

    %% Зовнішнє джерело даних
    USGS[("🌐 USGS Earthquakes API<br/>(External Data Source)")]:::external

    subgraph "Backend System (Node.js/Express)"
        direction TB
        Cron("🕒 Cron Scheduler<br/>(node-cron)"):::server
        IngestLogic("⚙️ Data Ingestion Logic<br/>(Fetch, Clean, Transform)"):::server
        ExpressAPI("🚀 Express Server<br/>(REST API Endpoints)"):::server
    end

    %% База даних
    MongoDB[("(DB) MongoDB<br/>(Geospatial Data)")]:::db

    subgraph "Frontend Client (Browser)"
        VanillaJS("🍦 Vanilla JS<br/>(App Logic & API Calls)"):::client
        Leaflet("🗺️ Leaflet.js<br/>(Interactive Map Rendering)"):::client
    end

    %% Потоки даних (Data Flows)
    Cron -- "1. Triggers job" --> IngestLogic
    IngestLogic -- "2. HTTP GET" --> USGS
    USGS -. "3. Raw JSON" .-> IngestLogic
    IngestLogic -- "4. Save Processed Data" --> MongoDB

    VanillaJS -- "A. HTTP GET /api/earthquakes" --> ExpressAPI
    ExpressAPI -- "B. DB Query" --> MongoDB
    MongoDB -. "C. Query Results" .-> ExpressAPI
    ExpressAPI -. "D. JSON Response" .-> VanillaJS
    VanillaJS -- "E. Render Data" --> Leaflet
