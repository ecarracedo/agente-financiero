# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-11-06

### Security
- **API No Longer Published**: The backend API no longer publishes a host port. It answers only on the Compose network, through the frontend proxy, closing the unauthenticated-public-API exposure in single-user mode (task 1.1, design D1). `API_PORT` is no longer interpolated and direct-API access requires a future authentication decision. Dev/local flows (Vite proxy, `generate:api:live`) keep their local `localhost:8000` targets.

### Added
- **Header + Portfolio Rework**: Portfolio total now shows in ARS (USD market value at CCL); new `GET /api/v1/fx/dollars` endpoint computes MEP (GD30/GD30D) and CCL (AAPL Cedear 20:1 over AAPL) with the RAVA methodology from own providers. TOTAL uses the backend `gain_loss_percent`; 24H is the holdings-weighted daily move from each position's series (no more hardcoded percentages). Header drops the asset search and the Trader Pro block; the SPX/NDX/BTC tape is now a continuous ticker that scrolls the configured symbols without navigation arrows. Tape configuration moved to the Configuración workspace ("Cinta de índices" section) reusing the transaction asset search (`TickerSearch`). Labels renamed: Posiciones, Moneda; Poder de Compra and Fixed Engine badge removed.
- **Real Asset Distribution**: `AssetDistributionCard` now computes the allocation from real portfolio positions valued at current market prices, grouped by real category and one section per currency (never summed across currencies). Positions without a price are excluded from totals and declared. The previous hardcoded mock ($148,650.80, 62%/23%/10%/5%, Score 9.4/10, "Efectivo") is gone.
- **ON and Letras Quotes (PPI)**: Obligaciones Negociables (`RUCDD`, `YMCJD`, etc.) and Letras del Tesoro (`S13N6`, etc.) now quote from the Portfolio Personal Inversiones `/Cotizaciones/Ons` and `/Cotizaciones/Letras` pages, searchable as "Corporate Bond" and "Treasury Bill". Prices are divided by 100 (PPI reports per 100 nominal), like bonds. User aliases now resolve in a single final pass over the full quote cache: a mapping can point a USD ticker at its ARS variant (`RUCDD -> RUCDO`) and the alias quote wins over the direct one.
- **Portfolio Positions**: Added Total and Variación columns to positions table with live quotes; added P&L column.
- **Quick Order**: Added broker selector (ECO, PPI, BINANCE) and asset type selector (Acciones, ETF, Bono, FCI, Cripto). Allow manual price editing. Removed SHS label.
- **Holdings Management**: Added "Vender" button to sell entire position at current price. Positions start empty in demo.
- **Editable Positions**: Broker and asset type are editable inline and are applied optimistically, reverting if the update fails.
- **Portfolio Catalog**: Brokers and asset types are configurable from the settings workspace and persisted locally.
- **Holdings Filters**: Filter holdings by ticker, asset type and broker, with a result counter and a clear action.
- **Recent Transactions**: "Últimas Transacciones" now lists the last three recorded operations instead of demo data.
- **Transactions API**: `GET /api/v1/transactions` accepts an optional `limit` and, when no ticker is given, returns the newest operations across the portfolio.
- **Local Market Data (PPI Provider)**: Argentine Bonds (`AE38`, `AL30`, `AL30D`, `GD30`, etc.) and Mutual Funds (`AL.DIVER.A` -> Allaria Diversificado Clase A) now quote from Portfolio Personal Inversiones public pages, cached daily. Falls back to yfinance for stocks/CEDEARs/crypto. Search autocomplete now includes bonds and FCIs. FCI prices scaled x1000 (PPI reports per 1000 cuotapartes). Bond prices divided by 100 (PPI reports per 100 nominal).
- **Ticker Aliases**: Broker symbols are mapped to the official PPI instrument name from Configuración. Mappings live in the `ticker_aliases` table behind `GET/POST/DELETE /api/v1/ticker-aliases`, with no hardcoded list in the provider. The editor offers only the assets held in the portfolio: pick one and type its alias.

### Changed
- **Dev Start Script**: `scripts/start.sh` replaces `scripts/start-demo.sh` and runs the Vite dev server against the real backend instead of the MSW demo fixtures.
- **Currency Handling**: Currency now follows the instrument's quote currency (ARS for .BA, USD for others). Fallback to USD if unavailable.
- **UI Polish**: Removed constant pulsing/loading effects. Narrowed sidebar and shrunk typography. Reordered columns (Broker after Variación). Hid currency suffix in Precio Promedio/Precio Actual. Total shows currency only as indicator. Removed ticker abbreviation badge.
- **Quick Order Labels**: "Precio / Acción" → "Precio", "Monto Total Estimado" → "Total", removed "Comisión FIX".

### Fixed
- **Frontend Build (Asset Distribution)**: Fixed TypeScript errors in `AssetDistributionCard.tsx` that broke `npm run build` (and the Coolify deployment): the per-category accumulator type now includes `invested`, `greenCount` and `redCount`. Type-only fix, no runtime logic change.
- **Missing `lib/datetime` in Fresh Clones**: `frontend/src/lib/datetime.ts` was never tracked because the Python `.gitignore` rule `lib/` matched `frontend/src/lib/` at any depth, so local builds passed while CI/Coolify (`Cannot find module '../../lib/datetime'`) failed. Anchored the Python `lib/`/`lib64/` rules to the repo root (`/lib/`, `/lib64/`) and tracked the helper.
- **Frontend Tests Currency Format**: Updated 13 stale frontend tests (`CurrencyAmount`, `AlertsPanel`, `PortfolioWorkspace`, `TransactionsWorkspace`) from US format (`1900.00`) to the global `$ 1.900,00` format, and made the holdings filter test assert on the quantity cell because the ticker cell shows the alias display name once aliases load. Full frontend suite now passes (28 files, 175 tests).
- **Single-User Authentication with 2FA**: Added login for the single user (`ecarracedo`) with a scrypt-hashed password seeded from `AUTH_*` env vars (never stored in plain text), opaque session cookies, and optional TOTP second factor with Fernet-encrypted secrets (`pyotp`, `cryptography`). All `/api/v1` routes now require a session; `/health` and `/ready` stay public. Frontend adds a login page (password + TOTP step), an auth gate, logout, and TOTP setup in Configuración. Backend 215 tests and frontend 178 tests pass.
- **Positions Table**: A broker or asset type that is no longer in the catalog now stays visible in its selector instead of leaving the control blank.
- **Portfolio Catalog**: The catalog memo now notices a `localStorage` change made by another path, so an edited catalog is never served stale.
- **Ticker aliases**: Fixed `FIMA.AH.P`, `AL.DIVER.A`, `SHC.PLUS.A` alias mapping; DB-backed alias reload after cache invalidation; alias editor now uses `broker_ticker` (official PPI name) in dropdown.
- **Currency format**: All monetary amounts now use global `es-AR` format (`$ 1.000,00`, space after symbol, point thousands, comma decimal).
- **Quick Order price input**: Accepts `,` decimal separator (`parseFloat` with `,` → `.` substitution) and sends normalized value to backend.
- **Ticker Aliases**: Added API contract tests for `GET/POST/DELETE /api/v1/ticker-aliases` (including alias upsert by broker ticker) and a provider test proving a DB-backed alias takes effect after cache invalidation.
- **Demo**: Fixed ticker search in demo mode, added Pampa tickers to fixtures.
- **Lint/Build**: Resolved React hooks and TypeScript issues.

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
