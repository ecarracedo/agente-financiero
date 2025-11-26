# Financial Agent / Agente Financiero

[English](#english) | [Español](#español)

---

<a name="english"></a>
## English

### Overview
This project is a Financial Agent designed to help you manage your stock portfolio. It analyzes your current holdings from an Excel file, identifies buy/sell opportunities based on market data, and manages a wishlist of stocks.

### Features
- **Portfolio Management**: Loads your transactions from an Excel file.
- **Market Analysis**: Fetches real-time data using `yfinance` to determine if stocks are cheap or expensive.
- **Wishlist**: Tracks potential investment opportunities.
- **Interactive UI**: A Streamlit-based web interface for easy interaction.

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
Este proyecto es un Agente Financiero diseñado para ayudarte a gestionar tu portafolio de acciones. Analiza tus tenencias actuales desde un archivo Excel, identifica oportunidades de compra/venta basadas en datos de mercado y gestiona una lista de deseos (wishlist).

### Características
- **Gestión de Portafolio**: Carga datos desde un archivo Excel (En desarrollo: detectando estructura de hojas).
- **Análisis de Mercado**: Obtiene datos en tiempo real usando `yfinance` para determinar si las acciones están baratas o caras.
    - *Funcionalidad*: Cálculo de máximos/mínimos de 52 semanas y medias móviles (50/200 días).
- **Lista de Deseos**: Rastrea oportunidades de inversión potenciales.
- **Interfaz Interactiva**: Una interfaz web basada en Streamlit (En proceso).

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
