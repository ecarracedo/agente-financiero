# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-11-06

### Security
- **API No Longer Published**: The backend API no longer publishes a host port. It answers only on the Compose network, through the frontend proxy, closing the unauthenticated-public-API exposure in single-user mode (task 1.1, design D1). `API_PORT` is no longer interpolated and direct-API access requires a future authentication decision. Dev/local flows (Vite proxy, `generate:api:live`) keep their local `localhost:8000` targets.

### Added
- **Alert Email and Global Popup**: Target-price crossings now reach the user through two channels. The background scheduler sends one SMTP email per new event (`AlertNotifierPort` with a stdlib `smtplib` adapter; `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `SMTP_TIMEOUT` and optional `ALERT_EMAIL_TO` in Compose/`.env.example`, defaulting to `AUTH_EMAIL`). Migration `a0009_alert_email_sent` adds `emailed_at`, backfills historical rows as already sent, and lets the scheduler retry only failed sends without duplicating or stopping the evaluation loop. An empty `SMTP_HOST` builds a no-op notifier, so existing deployments need no mail server. The in-app popup polls the event feed from `WorkspaceShell` on any workspace, seeds pre-existing ids as seen, deduplicates by event id, and never acknowledges on close. A short WebAudio beep is on by default, toggleable in Configuración → "Alertas", unlocked by the first click and silently skipped when audio is blocked. All popup visuals reuse the `QuickOrderCard` tokens.
- **Triggered Alert Events**: Every detected crossing is persisted (`alert_event_records`, migration `a0008_alert_events`) and the alerts workspace lists it — ticker, message, observed price and detection time — with an Acknowledge action per event and a "Check now" button that runs a pass through `POST /api/v1/alerts/evaluate`. A background scheduler evaluates every alert every 300 s inside the API process, so the events wait for the user in the workspace. Each crossing persists once; `GET /api/v1/alerts/events` lists pending events newest first and `POST /api/v1/alerts/events/{id}/acknowledge` marks one as seen (404 otherwise) without touching the alert or its position.
- **Deployment Guide (Domain and TLS)**: [`docs/operations/deploy.md`](docs/operations/deploy.md) documents publishing the stack under a real domain in Coolify: the single-origin design and why CORS must not be added, the environment variables that matter (`VITE_API_BASE_URL` is a build-time value and needs a rebuild, `COOKIE_SECURE=1`), the rule that a Coolify domain must point at the container port (`80`), DNS requirements for certificate issuance, verification commands, and the causes behind a Bad Gateway on the public domain. The README links to it from both language sections.
- **Per-100-Nominal Ticker Flag**: Yahoo Finance reports Argentine ONs such as `YFCOO.BA` as `EQUITY` with no bond marker, so the `quoteType == "BOND"` conversion never fired and positions were valued 100x too high. Configuración now has a "Cotización cada 100 nominales" section backed by `GET/PUT /api/v1/percent-of-par-tickers` (stored in `app_settings`, no migration). Flagged tickers are divided by 100 in both the yfinance provider and the composite fallback, for current quotes and historical series. PPI-served instruments are unaffected because PPI already reports per-100 prices divided by 100.
- **Alert Listing and Removal**: `GET /api/v1/alerts` returns every configured alert (`scope`, `ticker`, `broker`, `category`, `currency`, `target_price`, `intent`, `last_observed_price`) in a stable order: portfolio first, ticker A→Z. `DELETE /api/v1/portfolio/{ticker}/alert?broker=&category=` and `DELETE /api/v1/wishlist/{ticker}/alert` remove one alert without touching the position or the wishlist entry. The Alerts workspace lists configured alerts and prefills the panel with the saved target and type.
- **Accumulated Performance (Snapshots)**: `GET /api/v1/portfolio/snapshots` builds an ARS-denominated daily snapshot range (default 30 days) valued at current market prices with CCL conversion for USD positions. `POST /api/v1/portfolio/snapshots` creates the range; `GET/PUT /api/v1/portfolio/snapshot/schedule` configures the snapshot hour/timezone (default 17 hs Argentina, UTC-3). The `HistoricalChartCard` consumes this endpoint instead of recalculating on demand; no benchmark line, no hardcoded data. New tables: `portfolio_daily_snapshots` and `app_settings` (Alembic migration `a0007_daily_snapshot`).
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

### Removed
- **OpenSpec and Local Verification Scratch Removed**: the unused `openspec/` tree (60 tracked files of superseded proposals and specs) was deleted; ODD is the single workflow and its seven completed feature documents now live in `odd/archive/`. The gitignored `verify/` scratch directory (review artifacts plus a local virtualenv, ~118 MB) was also removed. Vendored Tremor attribution comments no longer point at the deleted change, and `.dockerignore` drops the stale `openspec/` entry.
- **Streamlit UI and `finance.db` Runtime Retired**: the legacy single-page Streamlit app (`main.py`, `src/`), its SQLite `finance.db` schema and migration scripts, the root `tests/` suite, `requirements.txt`, `debug_wishlist.py`, and `test.ipynb` were removed. The supported runtime is the containerized FastAPI + React stack documented in the README. After the migration to PostgreSQL was completed, the untracked `finance.db` source was also deleted; [`docs/operations/migration.md`](docs/operations/migration.md) keeps the executed procedure as a historical reference. The dead yfinance ÷100 path that lived only in `src/` is now implemented in the backend adapters (see Fixed).

### Changed
- **UI Baseline Rule**: the "Registrar Transacciones" card (`QuickOrderCard.tsx`) is now the mandatory visual reference for new and modified UI, with its spacing and typography tokens recorded in `AGENTS.md`. The "Creación Rápida de Alerta" card and its Target alert panel were aligned to that baseline: 10px mono labels, 12px mono controls on `#1c2028`, the segmented scope control, and the cyan primary button. Shared `TextField`/`SelectField` gained an additive `density="compact"` variant so other forms keep their existing scale.
- **Alerts Quick Creation**: the scope selector now lives inside the "Creación Rápida de Alerta" card as a compact control. Cartera and Wishlist show only their own positions; "Otro activo" reuses the transaction asset search (`TickerSearch` with provider suggestions) instead of a free-text ticker. The current quote is shown while configuring the target price and prefills it for assets without a saved alert.
- **Alert Types Reduced to Buy/Sell**: an alert is now asset + target price + type. `AlertIntent` exposes only `BUY` and `SELL`; `NEUTRAL` and `STOP_LOSS` were removed, and the form label "Intent" is now "Type". Alerts stored with a removed value stay inactive and are no longer listed — no schema migration was needed because `alert_intent` is a free-text column.
- **Dev Start Script**: `scripts/start.sh` replaces `scripts/start-demo.sh` and runs the Vite dev server against the real backend instead of the MSW demo fixtures.
- **Currency Handling**: Currency now follows the instrument's quote currency (ARS for .BA, USD for others). Fallback to USD if unavailable.
- **UI Polish**: Removed constant pulsing/loading effects. Narrowed sidebar and shrunk typography. Reordered columns (Broker after Variación). Hid currency suffix in Precio Promedio/Precio Actual. Total shows currency only as indicator. Removed ticker abbreviation badge.
- **Quick Order Labels**: "Precio / Acción" → "Precio", "Monto Total Estimado" → "Total", removed "Comisión FIX".

### Fixed
- **Production Build Type Errors**: the frontend Docker build failed on `npm run build` because `TriggeredAlertEvent` referenced a generated schema name that does not exist (`TriggeredAlertEventResponse` instead of `TriggeredAlertResponse`), and `AlertTarget.scope` was typed with the UI-only `custom` choice even though every target maps to `portfolio` or `wishlist`. Both references now match the generated contract; `npm run build`, the full test suite and lint pass.
- **Argentine ONs via Yahoo Finance (BOND ÷100)**: the yfinance market-data adapters (`YFinanceMarketDataProvider` and the composite provider's yfinance fallback) now divide `currentPrice` / `regularMarketPrice` / `previousClose` and historical closes by 100 when the instrument reports `quoteType == "BOND"`, matching the PPI path. A corporate bond quoted as a percentage of par (e.g. `YFC00.BA` at 96.38) was previously treated as an absolute per-unit price, inflating nominal-value calculations by 100x. Non-bond instruments (e.g. `EQUITY`) keep raw prices. The composite historical series also normalizes `datetime` close stamps to `date`.
- **Daily Snapshot Scheduler (Historical Performance)**: the API now writes the daily portfolio snapshot by itself, so the historical performance chart is no longer empty (fresh database) or frozen (last row days old). A background task polls once an hour and writes today's row when the configured `snapshot_hour` in `snapshot_timezone` (default 17 hs Argentina) has passed; it is idempotent per date, so restarts and repeated ticks never duplicate or rewrite history. When the snapshot table is empty the scheduler backfills the last 30 estimated days on the first tick, so a Coolify deployment shows the curve right away without a manual `POST /api/v1/portfolio/snapshots`. Every tick also recovers the missing days of the last 7 days (e.g. a day lost while the process was down or the market data provider was failing) writing only those gaps and leaving saved rows untouched. A portfolio without transactions logs a warning and never crashes the API.
- **Portfolio Lint and Loading**: Resolved the `react-hooks` lint errors in `HistoricalChartCard`, `PortfolioSummary` and `QuickOrderCard`; the historical chart no longer overflows its card; the header total shows USD immediately and upgrades to ARS when the exchange rates arrive (late responses are still applied). `scripts/start.sh` now starts postgres and backend (published on `127.0.0.1:8000` via the local-only `compose.local.yaml`) before Vite.
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
