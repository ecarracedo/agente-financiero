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
The React web interface lives in `frontend/` and talks to the backend only through its HTTP API — it needs no Streamlit process and no direct database access at runtime. Configure the API base URL with `VITE_API_BASE_URL` (see `frontend/.env.example`); it defaults to `http://localhost:8000`.

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
La interfaz web en React vive en `frontend/` y se comunica con el backend únicamente a través de su API HTTP — no requiere Streamlit ni acceso directo a la base de datos en tiempo de ejecución. Configurá la URL base de la API con `VITE_API_BASE_URL` (ver `frontend/.env.example`); por defecto usa `http://localhost:8000`.

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

### Migración de datos
Los datos legados de SQLite (`finance.db`) se migran al destino con un mapeo explícito `ticker → moneda` que nunca se infiere. El procedimiento completo, los comandos, la expectativa de reconciliación y los pasos de restauración están en [`docs/operations/migration.md`](docs/operations/migration.md). Ensayar el flujo completo sobre una copia sin tocar la fuente:
```bash
python verify/verify_migration_rehearsal.py --source finance.db --currency-map /tmp/ars.json
```

