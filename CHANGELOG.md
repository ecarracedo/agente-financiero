# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-12-08

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
