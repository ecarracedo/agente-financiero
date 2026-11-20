# Financial Agent / Agente Financiero

[English](#english) | [Español](#español)

---

<a name="english"></a>
## English

### Overview
This project is a Financial Agent designed to help you manage your stock portfolio. It analyzes your current holdings from an Excel file, identifies buy/sell opportunities based on market data, and manages a wishlist of stocks.

### Features
- **Portfolio Management**: Tracks your positions and transactions in the backend database.
- **Transaction Management**: Record Buy/Sell operations directly in the app.
    - *Weighted Average Logic*: Automatically calculates weighted average purchase price. Selling shares does not affect the average price of remaining shares.
- **Per-100-Nominal Instruments**: ONs and Letras quote per 100 nominal units. Tickers that Yahoo Finance reports as equities can be flagged in Configuración so their price is divided by 100.
- **Portfolio Visualization**: Interactive charts showing composition by category and asset allocation.
- **Performance Tracking**: Real-time display of current prices, total value, and gain/loss metrics ($ and %).
    - *Auto-Refresh*: Automatic price updates with configurable intervals and manual refresh button.
- **History**: View and manage your transaction history, including the ability to delete individual transactions.
- **Advanced Stock Charts**: Interactive Plotly charts with Candlestick/Area modes, smart axis scaling for highs, and visual price alerts.
- **Market Analysis**: Fetches real-time data using `yfinance` to determine if stocks are cheap or expensive.
- **Wishlist**: Tracks potential investment opportunities with market validation.
- **Bibliography**: Manage your library of financial books and resources.
- **Interactive UI**: A React web interface talking to a FastAPI backend through its HTTP API.

### Setup
The Streamlit UI and `finance.db` were removed. The single supported runtime is the containerized stack:

```bash
cp .env.example .env    # set POSTGRES_PASSWORD before the first run
docker compose up -d --build --wait
```

The web interface answers on `http://localhost:${WEB_PORT}`. For local development without containers, run the backend directly and use the Vite dev server:

```bash
pip install -e "backend[test]"
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

cd frontend
npm install
npm run dev
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

#### Demo mode (no backend)
Every `/api/v1` route is served by a Mock Service Worker, so the interface can be walked with sample data while the backend is stopped or empty:

```bash
cd frontend
VITE_DEMO=1 npm run dev
```

The handlers and fixtures in `frontend/src/mocks/` are the same ones the tests use, so demo data cannot drift from test data. The flag only works on the dev server: a production build never starts the worker, and MSW is not part of the built bundle (`src/dev/demo.ts` imports it dynamically behind `import.meta.env.DEV`). Anything the fixtures do not cover is still requested from the network, so a missing route shows up as a failure instead of an empty view.

### Docker Compose
The whole stack — PostgreSQL, the backend API and the web interface — runs with Compose. Copy `.env.example` to `.env` and set a password there: configuration reaches the containers only through the environment, never through a file copied into an image.

```bash
cp .env.example .env    # set POSTGRES_PASSWORD before the first run
docker compose up -d --build --wait
```

- The web interface answers on `http://localhost:${WEB_PORT}`. The backend API is not published to the host: it is reachable only on the Compose network, through the frontend proxy. Reopening a direct API port requires an explicit authentication decision first.
- PostgreSQL is reachable only on the Compose network: it declares `expose`, never `ports`, and keeps its data in the `postgres_data` volume.
- The backend applies `alembic upgrade head` before starting Uvicorn, and waits for a healthy database first.
- The frontend container serves the built SPA with Nginx and proxies `/api` to the backend on the same origin, so the browser makes no cross-origin request. It proxies `/health` and `/ready` the same way, so a probe on the published origin reads the real status instead of the SPA's entry point. The image bakes `VITE_API_BASE_URL` at build time, so keep it equal to the published frontend origin and rebuild after changing it.
- `/health` reports the process; `/ready` reports the database and answers 503 while PostgreSQL is down. When that happens the web interface shows its error state instead of stale numbers.

To publish the stack under your own domain with TLS (Coolify, DNS, build variables and the container-port rule), see [`docs/operations/deploy.md`](docs/operations/deploy.md).

Development layers an override over the same base file. It reloads the backend from the mounted source, runs the Vite dev server on `http://localhost:${WEB_DEV_PORT}` and keeps its data in a separate `postgres_dev_data` volume:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

- The dev frontend runs `npm ci` before Vite serves anything, so the page answers a few seconds after the containers report running. The override resets the image healthcheck, which probes the Nginx port that the dev server does not use.

The agent is not deployed to AWS. `strands-agents` is a library dependency, and its model and region (`AGENT_MODEL_ID`, `AWS_REGION`) are read from the environment whenever an agent route exposes it; no Compose service consumes them yet.

### Data Migration
The legacy SQLite source (`finance.db`) was migrated to PostgreSQL and then removed from the repository. The supported runtime keeps all portfolio, transaction and wishlist data in the Compose PostgreSQL volume. [`docs/operations/migration.md`](docs/operations/migration.md) records the completed procedure and its explicit `ticker → currency` mapping as a historical reference; it cannot be re-run without a legacy source copy.

---

<a name="español"></a>
## Español

### Descripción General
Este proyecto es un Agente Financiero diseñado para ayudarte a gestionar tu portafolio de acciones. Analiza tus tenencias actuales, permite registrar operaciones de compra/venta, identifica oportunidades basadas en datos de mercado y gestiona una lista de deseos y bibliografía.

### Características
- **Gestión de Portafolio**: Registra posiciones y transacciones en la base de datos del backend.
- **Gestión de Transacciones**: Registra operaciones de Compra y Venta directamente desde la interfaz.
    - *Lógica de Promedio Ponderado*: Calcula automáticamente el precio promedio ponderado. Las ventas no afectan el precio promedio de las acciones restantes.
    - *Soporte Multi-Activo*: Soporta Acciones, Cedears, Bonos, ONs, Cripto, FCI y Letras.
- **Instrumentos cada 100 nominales**: Las ONs y Letras cotizan por cada 100 nominales. Los tickers que Yahoo Finance reporta como acciones se pueden marcar en Configuración para que su precio se divida por 100.
- **Visualización de Portafolio**: Gráficos interactivos de composición por categoría y distribución por activo.
- **Seguimiento de Rendimiento**: Muestra en tiempo real precios actuales, valor total, y métricas de ganancia/pérdida ($ y %).
    - *Auto-Actualización*: Actualización automática de precios con intervalos configurables y botón de actualización manual.
- **Historial**: Visualiza un registro completo de todas tus transacciones con opción de eliminar registros individuales.
- **Gráficos Avanzados**: Gráficos interactivos (Velas/Área) con escalado inteligente y visualización de alertas de precio objetivo.
- **Análisis de Mercado**: Obtiene datos en tiempo real usando `yfinance` para detectar oportunidades (Máximos/Mínimos, Medias Móviles).
- **Lista de Deseos (Wishlist)**: Rastrea acciones que te interesan con validación de mercado.
- **Bibliografía**: Gestiona tu biblioteca de conocimientos (Libros, Artículos, Videos).
- **Interfaz Interactiva**: Interfaz web en React comunicada con el backend FastAPI mediante su API HTTP.

### Configuración
La interfaz Streamlit y `finance.db` fueron retiradas. El único runtime soportado es el stack en contenedores:

```bash
cp .env.example .env    # definí POSTGRES_PASSWORD antes del primer arranque
docker compose up -d --build --wait
```

La interfaz web responde en `http://localhost:${WEB_PORT}`. Para desarrollo local sin contenedores, levantá el backend directo y el servidor de Vite:

```bash
pip install -e "backend[test]"
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

cd frontend
npm install
npm run dev
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

#### Modo demo (sin backend)
Todas las rutas `/api/v1` las sirve un Mock Service Worker, así que la interfaz se puede recorrer con datos de ejemplo aunque el backend esté detenido o vacío:

```bash
cd frontend
VITE_DEMO=1 npm run dev
```

Los handlers y fixtures de `frontend/src/mocks/` son los mismos que usan los tests, así que los datos de demo no pueden desviarse de los de prueba. El flag solo funciona en el servidor de desarrollo: un build de producción nunca arranca el worker y MSW no forma parte del bundle (`src/dev/demo.ts` lo importa dinámicamente detrás de `import.meta.env.DEV`). Lo que los fixtures no cubren se pide igual a la red, así que una ruta faltante se ve como un fallo y no como una vista vacía.

### Docker Compose
Todo el stack — PostgreSQL, la API del backend y la interfaz web — corre con Compose. Copiá `.env.example` a `.env` y definí ahí una contraseña: la configuración llega a los contenedores solo por variables de entorno, nunca por un archivo copiado dentro de una imagen.

```bash
cp .env.example .env    # definí POSTGRES_PASSWORD antes del primer arranque
docker compose up -d --build --wait
```

- La interfaz web responde en `http://localhost:${WEB_PORT}`. La API del backend no se publica al host: solo es alcanzable en la red de Compose, a través del proxy del frontend. Reabrir un puerto directo de API requiere primero una decisión explícita de autenticación.
- PostgreSQL solo es alcanzable en la red de Compose: declara `expose`, nunca `ports`, y guarda sus datos en el volumen `postgres_data`.
- El backend aplica `alembic upgrade head` antes de levantar Uvicorn, y primero espera a que la base esté sana.
- El contenedor del frontend sirve la SPA compilada con Nginx y proxya `/api` al backend en el mismo origen, así que el navegador no hace ninguna petición cross-origin. También proxya `/health` y `/ready`, así que una sonda sobre el origen público lee el estado real y no la entrada de la SPA. La imagen fija `VITE_API_BASE_URL` en tiempo de build, así que mantenelo igual al origen público del frontend y recompilá tras cambiarlo.
- `/health` reporta el proceso; `/ready` reporta la base y responde 503 mientras PostgreSQL está caído. Cuando eso pasa, la interfaz web muestra su estado de error en lugar de números viejos.

Para publicar el stack con un dominio propio y TLS (Coolify, DNS, variables de build y la regla del puerto del contenedor), ver [`docs/operations/deploy.md`](docs/operations/deploy.md).

El desarrollo superpone un override sobre el mismo archivo base. Recarga el backend desde el código montado, levanta el servidor de desarrollo de Vite en `http://localhost:${WEB_DEV_PORT}` y guarda sus datos en un volumen `postgres_dev_data` aparte:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

- El frontend de desarrollo corre `npm ci` antes de que Vite sirva nada, así que la página responde unos segundos después de que los contenedores reporten estar en marcha. El override anula el healthcheck de la imagen, que apunta al puerto de Nginx que el servidor de desarrollo no usa.

El agente no se despliega en AWS. `strands-agents` es una dependencia de librería, y su modelo y región (`AGENT_MODEL_ID`, `AWS_REGION`) se leen del entorno cuando alguna ruta exponga el agente; ningún servicio de Compose los consume todavía.

### Migración de datos
La fuente legada de SQLite (`finance.db`) fue migrada a PostgreSQL y luego eliminada del repositorio. El runtime soportado conserva todos los datos de portafolio, transacciones y lista de deseos en el volumen de PostgreSQL de Compose. [`docs/operations/migration.md`](docs/operations/migration.md) registra el procedimiento ya ejecutado y su mapeo explícito `ticker → moneda` como referencia histórica; no se puede repetir sin una copia de la fuente legada.

