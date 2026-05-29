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
    </td>

    %% База даних
    MongoDB[("(DB) MongoDB<br/>(Geospatial Data)")]:::db

    subgraph "Frontend Client (Browser)"
        VanillaJS("🍦 Vanilla JS<br/>(App Logic & API Calls)"):::client
        Leaflet("🗺️ Leaflet.js<br/>(Interactive Map Rendering)"):::client
    end

    %% Потоки даних (Data Flows)

    %% 1. Процес збору даних (Data Ingestion Flow)
    Cron -- "1. Triggers job (periodically)" --> IngestLogic
    IngestLogic -- "2. HTTP GET Request" --> USGS
    USGS -. "3. Raw JSON Data" .-> IngestLogic
    IngestLogic -- "4. Save Processed Data" --> MongoDB

    %% 2. Процес обслуговування клієнта (Client Serving Flow)
    VanillaJS -- "A. HTTP GET /api/earthquakes" --> ExpressAPI
    ExpressAPI -- "B. Mongoose Query" --> MongoDB
    MongoDB -. "C. Query Results" .-> ExpressAPI
    ExpressAPI -. "D. JSON Response" .-> VanillaJS
    VanillaJS -- "E. Render Data" --> Leaflet