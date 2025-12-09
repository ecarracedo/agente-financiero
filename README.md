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
    python src/create_empty_db.py
    ```
3.  Run the application:
    ```bash
    streamlit run main.py
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
    python src/create_empty_db.py
    ```
3.  Ejecutar la aplicación:
    ```bash
    streamlit run main.py
    ```

