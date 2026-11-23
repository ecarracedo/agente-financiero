# Project Backlog

## 🚀 New Features
- [x] **Portfolio Performance Charts**: `HistoricalChartCard` renders real values from `GET /api/v1/portfolio/snapshots`; the scheduler writes the daily snapshots.
- [ ] **Export Reports**: Generate PDF/Excel reports of portfolio status.
- [ ] **Multi-Currency Support**: Better handling of USD/ARS and exchange rates (CCL/MEP).
- [ ] **Chart Purchase Price**: Display average purchase price line on stock charts for portfolio items.
- [x] **Alerts (Email)**: One SMTP email per price crossing, configured through Compose and `.env.example`.
- [ ] **Alerts (Telegram)**: Telegram notifications for price targets.

## 🛠 Improvements
- [x] **Refactor Market Data**: Optimize `yfinance` calls to reduce latency.
- [ ] **Database Backup**: Automated backup of the Compose PostgreSQL database.
- [x] **Wishlist Analysis**: Show price history (3, 6, 12 months) and monthly variation.

## 🗃 Superseded
- `feature/portfolio-historical-performance` (unmerged, 5 commits): replaced by the snapshot-based historical chart on `dev`. Its on-demand `GET /api/v1/portfolio/performance` design conflicts with the current chart and snapshot scheduler. Kept locally for reference, not merged.

## 🐛 Known Issues
- None currently.
