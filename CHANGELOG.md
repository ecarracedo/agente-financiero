# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Portfolio Positions**: Added Total and Variación columns to positions table with live quotes; added P&L column.
- **Quick Order**: Added broker selector (ECO, PPI, BINANCE) and asset type selector (Acciones, ETF, Bono, FCI, Cripto). Allow manual price editing. Removed SHS label.
- **Holdings Management**: Added "Vender" button to sell entire position at current price. Positions start empty in demo.
- **Editable Positions**: Broker and asset type are editable inline and are applied optimistically, reverting if the update fails.
- **Portfolio Catalog**: Brokers and asset types are configurable from the settings workspace and persisted locally.
- **Holdings Filters**: Filter holdings by ticker, asset type and broker, with a result counter and a clear action.
- **Recent Transactions**: "Últimas Transacciones" now lists the last three recorded operations instead of demo data.
- **Transactions API**: `GET /api/v1/transactions` accepts an optional `limit` and, when no ticker is given, returns the newest operations across the portfolio.
- **Local Market Data (PPI Provider)**: Argentine Bonds (`AE38`, `AL30`, `AL30D`, `GD30`, etc.) and Mutual Funds (`AL.DIVER.A` -> Allaria Diversificado Clase A) now quote from Portfolio Personal Inversiones public pages, cached daily. Falls back to yfinance for stocks/CEDEARs/crypto. Search autocomplete now includes bonds and FCIs. FCI prices scaled x1000 (PPI reports per 1000 cuotapartes). Bond prices divided by 100 (PPI reports per 100 nominal).

### Changed
- **Currency Handling**: Currency now follows the instrument's quote currency (ARS for .BA, USD for others). Fallback to USD if unavailable.
- **UI Polish**: Removed constant pulsing/loading effects. Narrowed sidebar and shrunk typography. Reordered columns (Broker after Variación). Hid currency suffix in Precio Promedio/Precio Actual. Total shows currency only as indicator. Removed ticker abbreviation badge.
- **Quick Order Labels**: "Precio / Acción" → "Precio", "Monto Total Estimado" → "Total", removed "Comisión FIX".

### Fixed
- **Positions Table**: A broker or asset type that is no longer in the catalog now stays visible in its selector instead of leaving the control blank.
- **Portfolio Catalog**: The catalog memo now notices a `localStorage` change made by another path, so an edited catalog is never served stale.
- **Demo**: Fixed ticker search in demo mode, added Pampa tickers to fixtures.
- **Lint/Build**: Resolved React hooks and TypeScript issues.

### Added
- **Demo Script**: Added `scripts/start-demo.sh` to run frontend in demo mode.

## [1.2.0] - 2025-12-18

### Added
- **Split Calculator Tool**:
  - New "🛠️ Herramientas" tab for utility tools.
  - Interactive calculator for forward and reverse stock splits.
  - Instant projection of new quantity and adjusted average cost.
- **Architectural Improvements**:
  - Modular project structure: `models/`, `services/`, `ui/`, `external/`, and `scripts/`.
  - Improved code organization and maintainability.

### Fixed
- **Holdings Table**: Resolved `TypeError` caused by incorrect `st.dataframe` width argument.

## [1.1.0] - 2025-12-09

### Added
- **Interactive Stock Charts Tab**:
  - Full-screen interactive charts powered by Plotly.
  - Toggle between **Candlestick** (Velas) and **Area/Line** views.
  - **Dynamic Axis Scaling**: Automatically adds 40% vertical headroom when price is near period highs for better trend visualization.
  - **Price Alerts Integration**: Displays configured target prices (from Portfolio or Wishlist) as visible red dashed lines on the chart.
  - Real-time price header with daily change metrics.


### Changed
- **Auto-Refresh**: Replaced full page reload with partial updates using `st.fragment` for the holdings table.
- **UI**: Cleaned up sidebar metrics and fixed duplicate headers.

### Fixed
- **Button Error**: Fixed `st.button` argument error (deprecated `width` parameter).

## [1.0.0] - 2025-12-05

### Added
- **Portfolio Management System**
  - SQLite database for persistent storage of portfolio data
  - Support for multiple asset categories: Acciones, Cedears, Bonos, ONs, Cripto, FCI, Letras
  - Multi-broker support with separate position tracking per broker
  - Weighted average price calculation for holdings

- **Transaction Management**
  - Buy/Sell operation recording with date, price, quantity, broker, and category
  - Transaction history view with complete audit trail
  - Individual transaction deletion with automatic portfolio recalculation
  - Automatic date reset to current day after recording operations

- **Real-time Market Data**
  - Integration with yfinance for live price fetching
  - Auto-refresh system with configurable intervals (1min, 5min, 15min, 30min, 1h)
  - Manual "Actualizar Ahora" button with force refresh capability
  - Price caching to minimize API calls
  - Last update timestamp display

- **Portfolio Visualization**
  - Interactive charts showing portfolio composition by category
  - Asset allocation pie chart
  - Detailed holdings table with:
    - Current prices
    - Total value calculation
    - Gain/Loss in dollars and percentage
    - Color-coded performance (green for gains, red for losses)

- **Wishlist Feature**
  - Track potential investment opportunities
  - Market validation for ticker symbols
  - Separate tracking for US and Argentine markets (.BA suffix)
  - Add/remove wishlist items

- **Bibliography Management**
  - Organize financial learning resources
  - Support for books, articles, and videos
  - Categorization and metadata tracking

- **User Interface**
  - Streamlit-based web interface
  - Organized tabs: Portfolio, Operations, Opportunities, Wishlist, Bibliography
  - Responsive design with real-time updates
  - Input validation and error handling

- **Development Tools**
  - Database initialization script (`src/create_empty_db.py`)
  - Test suite for average price calculations
  - Verification scripts for portfolio integrity

### Fixed
- Corrected average price calculation logic: selling shares no longer affects the average price of remaining shares
- Proper quantity reduction when selling assets
- Error handling for selling non-existent positions
- Market validation to prevent cross-market ticker errors (e.g., .BA suffix on US market)

### Changed
- Reorganized project structure:
  - Test files moved to `tests/` directory
  - Verification scripts moved to `verify/` directory
  - Removed unused utility scripts
- Updated README with comprehensive setup instructions
- Improved transaction form with automatic field reset

### Technical Details
- **Database Schema**: PortfolioItem, Transaction, WishlistItem, BibliographyItem tables
- **Dependencies**: Streamlit, yfinance, pandas, peewee, plotly
- **Python Version**: 3.13 recommended

---

## Release Notes

This is the first stable release (MVP) of the Financial Agent application. The system provides a complete solution for managing a stock portfolio with real-time market data, transaction tracking, and performance analytics.

**Key Highlights:**
- ✅ Full CRUD operations for portfolio management
- ✅ Real-time price updates with auto-refresh
- ✅ Accurate weighted average cost tracking
- ✅ Multi-asset and multi-broker support
- ✅ Transaction history with deletion capability
- ✅ Visual performance tracking with color-coded gains/losses

**Known Limitations:**
- Price data depends on yfinance API availability and may have delays
- No user authentication (single-user application)
- No data export functionality yet

**Future Roadmap:**
- Portfolio performance reports and analytics
- Data export to CSV/Excel
- Advanced charting and technical indicators
- Multi-currency support
