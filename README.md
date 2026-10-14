# Financial Agent / Agente Financiero

[English](#english) | [Español](#español)

---

<a name="english"></a>
## English

### Overview
This project is a Financial Agent designed to help you manage your stock portfolio. It analyzes your current holdings from an Excel file, identifies buy/sell opportunities based on market data, and manages a wishlist of stocks.

### Features
- **Portfolio Management**: Loads your transactions from an Excel file and stores them in a local SQLite database.
- **Transaction Management**: Record Buy/Sell operations directly in the app.
    - *Weighted Average Logic*: Automatically calculates weighted average purchase price. Selling shares does not affect the average price of remaining shares.
- **Portfolio Visualization**: Interactive charts showing composition by category and asset allocation.
- **Performance Tracking**: Real-time display of current prices, total value, and gain/loss metrics ($ and %).
    - *Auto-Refresh*: Automatic price updates with configurable intervals and manual refresh button.
- **History**: View and manage your transaction history, including the ability to delete individual transactions.
- **Advanced Stock Charts**: Interactive Plotly charts with Candlestick/Area modes, smart axis scaling for highs, and visual price alerts.
- **Market Analysis**: Fetches real-time data using `yfinance` to determine if stocks are cheap or expensive.
- **Wishlist**: Tracks potential investment opportunities with market validation.
- **Bibliography**: Manage your library of financial books and resources.
- **Interactive UI**: A Streamlit-based web interface with tabs for Portfolio, Operations, Opportunities, Wishlist, and Bibliography.

### Setup
1.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
2.  Create an empty database for the initial configuration:
    ```bash
    python src/scripts/create_empty_db.py
    ```
3.  Run the application:
    ```bash
    streamlit run main.py
    ```

### Frontend (web)
The React web interface lives in `frontend/` and talks to the backend only through its HTTP API — it needs no Streamlit process and no direct database access at runtime. Configure the API base URL with `VITE_API_BASE_URL` in `frontend/.env` (see `frontend/.env.example`). Development is single-origin like production: point it at the Vite dev server so its proxy forwards `/api` to the backend, and set `VITE_PROXY_TARGET` when the backend is not on `http://localhost:8000`.

```bash
cd frontend
npm install
npm run generate:api   # regenerate src/api/types.ts from the versioned openapi.json
npm run dev            # start the Vite dev server
npm run build          # type-check (tsc) + production build
npm test               # run Vitest + React Testing Library
```

The versioned `frontend/openapi.json` is generated from the backend app:
```bash
python -c "import json; from backend.app.main import create_app; print(json.dumps(create_app().openapi(), indent=2))" > frontend/openapi.json
```

### Docker Compose
The whole stack — PostgreSQL, the backend API and the web interface — runs with Compose. Copy `.env.example` to `.env` and set a password there: configuration reaches the containers only through the environment, never through a file copied into an image.

```bash
cp .env.example .env    # set POSTGRES_PASSWORD before the first run
docker compose up -d --build --wait
```

- The API answers on `http://localhost:${API_PORT}` and the web interface on `http://localhost:${WEB_PORT}`.
- PostgreSQL is reachable only on the Compose network: it declares `expose`, never `ports`, and keeps its data in the `postgres_data` volume.
- The backend applies `alembic upgrade head` before starting Uvicorn, and waits for a healthy database first.
- The frontend container serves the built SPA with Nginx and proxies `/api` to the backend on the same origin, so the browser makes no cross-origin request. It proxies `/health` and `/ready` the same way, so a probe on the published origin reads the real status instead of the SPA's entry point. The image bakes `VITE_API_BASE_URL` at build time, so keep it equal to the published frontend origin and rebuild after changing it.
- `/health` reports the process; `/ready` reports the database and answers 503 while PostgreSQL is down. When that happens the web interface shows its error state instead of stale numbers.

Development layers an override over the same base file. It reloads the backend from the mounted source, runs the Vite dev server on `http://localhost:${WEB_DEV_PORT}` and keeps its data in a separate `postgres_dev_data` volume:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

The agent is not deployed to AWS. `strands-agents` is a library dependency, and its model and region (`AGENT_MODEL_ID`, `AWS_REGION`) are read from the environment whenever an agent route exposes it; no Compose service consumes them yet.

### Data Migration
Legacy SQLite data (`finance.db`) is migrated to the destination database using an explicit `ticker → currency` mapping that is never inferred. See the full procedure, commands, reconciliation expectations, and restore steps in [`docs/operations/migration.md`](docs/operations/migration.md). Rehearse the whole flow against a copy without touching the source:
```bash
python verify/verify_migration_rehearsal.py --source finance.db --currency-map /tmp/ars.json
```

---

<a name="español"></a>
## Español

### Descripción General
Este proyecto es un Agente Financiero diseñado para ayudarte a gestionar tu portafolio de acciones. Analiza tus tenencias actuales, permite registrar operaciones de compra/venta, identifica oportunidades basadas en datos de mercado y gestiona una lista de deseos y bibliografía.

### Características
- **Gestión de Portafolio**: Carga datos iniciales desde Excel y mantiene un registro persistente en base de datos SQLite.
- **Gestión de Transacciones**: Registra operaciones de Compra y Venta directamente desde la interfaz.
    - *Lógica de Promedio Ponderado*: Calcula automáticamente el precio promedio ponderado. Las ventas no afectan el precio promedio de las acciones restantes.
    - *Soporte Multi-Activo*: Soporta Acciones, Cedears, Bonos, ONs, Cripto, FCI y Letras.
- **Visualización de Portafolio**: Gráficos interactivos de composición por categoría y distribución por activo.
- **Seguimiento de Rendimiento**: Muestra en tiempo real precios actuales, valor total, y métricas de ganancia/pérdida ($ y %).
    - *Auto-Actualización*: Actualización automática de precios con intervalos configurables y botón de actualización manual.
- **Historial**: Visualiza un registro completo de todas tus transacciones con opción de eliminar registros individuales.
- **Gráficos Avanzados**: Gráficos interactivos (Velas/Área) con escalado inteligente y visualización de alertas de precio objetivo.
- **Análisis de Mercado**: Obtiene datos en tiempo real usando `yfinance` para detectar oportunidades (Máximos/Mínimos, Medias Móviles).
- **Lista de Deseos (Wishlist)**: Rastrea acciones que te interesan con validación de mercado.
- **Bibliografía**: Gestiona tu biblioteca de conocimientos (Libros, Artículos, Videos).
- **Interfaz Interactiva**: Interfaz web basada en Streamlit con pestañas organizadas.

### Configuración
1.  Instalar dependencias:
    ```bash
    pip install -r requirements.txt
    ```
2.  Crear una base de datos vacía para la configuración inicial:
    ```bash
    python src/scripts/create_empty_db.py
    ```
3.  Ejecutar la aplicación:
    ```bash
    streamlit run main.py
    ```

### Frontend (web)
La interfaz web en React vive en `frontend/` y se comunica con el backend únicamente a través de su API HTTP — no requiere Streamlit ni acceso directo a la base de datos en tiempo de ejecución. Configurá la URL base de la API con `VITE_API_BASE_URL` en `frontend/.env` (ver `frontend/.env.example`). El desarrollo es de un solo origen, igual que producción: apuntala al servidor de desarrollo de Vite para que su proxy reenvíe `/api` al backend, y definí `VITE_PROXY_TARGET` cuando el backend no esté en `http://localhost:8000`.

```bash
cd frontend
npm install
npm run generate:api   # regenera src/api/types.ts desde el openapi.json versionado
npm run dev            # inicia el servidor de desarrollo de Vite
npm run build          # chequeo de tipos (tsc) + build de producción
npm test               # ejecuta Vitest + React Testing Library
```

El `frontend/openapi.json` versionado se genera desde la aplicación backend:
```bash
python -c "import json; from backend.app.main import create_app; print(json.dumps(create_app().openapi(), indent=2))" > frontend/openapi.json
```

### Docker Compose
Todo el stack — PostgreSQL, la API del backend y la interfaz web — corre con Compose. Copiá `.env.example` a `.env` y definí ahí una contraseña: la configuración llega a los contenedores solo por variables de entorno, nunca por un archivo copiado dentro de una imagen.

```bash
cp .env.example .env    # definí POSTGRES_PASSWORD antes del primer arranque
docker compose up -d --build --wait
```

- La API responde en `http://localhost:${API_PORT}` y la interfaz web en `http://localhost:${WEB_PORT}`.
- PostgreSQL solo es alcanzable en la red de Compose: declara `expose`, nunca `ports`, y guarda sus datos en el volumen `postgres_data`.
- El backend aplica `alembic upgrade head` antes de levantar Uvicorn, y primero espera a que la base esté sana.
- El contenedor del frontend sirve la SPA compilada con Nginx y proxya `/api` al backend en el mismo origen, así que el navegador no hace ninguna petición cross-origin. También proxya `/health` y `/ready`, así que una sonda sobre el origen público lee el estado real y no la entrada de la SPA. La imagen fija `VITE_API_BASE_URL` en tiempo de build, así que mantenelo igual al origen público del frontend y recompilá tras cambiarlo.
- `/health` reporta el proceso; `/ready` reporta la base y responde 503 mientras PostgreSQL está caído. Cuando eso pasa, la interfaz web muestra su estado de error en lugar de números viejos.

El desarrollo superpone un override sobre el mismo archivo base. Recarga el backend desde el código montado, levanta el servidor de desarrollo de Vite en `http://localhost:${WEB_DEV_PORT}` y guarda sus datos en un volumen `postgres_dev_data` aparte:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

El agente no se despliega en AWS. `strands-agents` es una dependencia de librería, y su modelo y región (`AGENT_MODEL_ID`, `AWS_REGION`) se leen del entorno cuando alguna ruta exponga el agente; ningún servicio de Compose los consume todavía.

### Migración de datos
Los datos legados de SQLite (`finance.db`) se migran al destino con un mapeo explícito `ticker → moneda` que nunca se infiere. El procedimiento completo, los comandos, la expectativa de reconciliación y los pasos de restauración están en [`docs/operations/migration.md`](docs/operations/migration.md). Ensayar el flujo completo sobre una copia sin tocar la fuente:
```bash
python verify/verify_migration_rehearsal.py --source finance.db --currency-map /tmp/ars.json
```

