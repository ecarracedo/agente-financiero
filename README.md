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
    - *Net Investment Logic*: Automatically calculates weighted average purchase price using the "Net Investment" method.
- **Portfolio Visualization**: Interactive charts showing composition by category and asset allocation.
- **Performance Tracking**: Real-time display of current prices, total value, and gain/loss metrics ($ and %).
- **Market Analysis**: Fetches real-time data using `yfinance` to determine if stocks are cheap or expensive.
- **Wishlist**: Tracks potential investment opportunities with market validation.
- **Bibliography**: Manage your library of financial books and resources.
- **Interactive UI**: A Streamlit-based web interface with tabs for Portfolio, Operations, Opportunities, Wishlist, and Bibliography.

### Setup
1.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
2.  Run the application:
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
    - *Lógica de Inversión Neta*: Calcula automáticamente el precio promedio usando el método de "Inversión Neta" (resta el monto recuperado en ventas del costo total).
- **Visualización de Portafolio**: Gráficos interactivos de composición por categoría y distribución por activo.
- **Seguimiento de Rendimiento**: Muestra en tiempo real precios actuales, valor total, y métricas de ganancia/pérdida ($ y %).
- **Historial**: Visualiza un registro completo de todas tus transacciones.
- **Análisis de Mercado**: Obtiene datos en tiempo real usando `yfinance` para detectar oportunidades (Máximos/Mínimos, Medias Móviles).
- **Lista de Deseos (Wishlist)**: Rastrea acciones que te interesan con validación de mercado.
- **Bibliografía**: Gestiona tu biblioteca de conocimientos (Libros, Artículos, Videos).
- **Interfaz Interactiva**: Interfaz web basada en Streamlit con pestañas organizadas.

### Configuración
1.  **Requisitos**: Python 3.13 recomendado.
2.  Instalar dependencias:
    ```bash
    pip install -r requirements.txt
    ```
3.  Ejecutar la aplicación:
    ```bash
    streamlit run main.py
    ```
