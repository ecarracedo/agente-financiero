# Proposal: Local Bonds and Mutual Funds Market Data (PPI Provider)

## Intent

Stock and CEDEAR quotes are served by `yfinance`, but Argentine Sovereign/Corporate
Bonds (Bonos) and Mutual Funds (Fondos Comunes de Inversión - FCI) are not available on
Yahoo Finance. Users holding bonds (e.g. `AE38`, `AL30`) and mutual funds (e.g.
`AL.DIVER.A` -> Allaria Diversificado Clase A) currently see "—" (unpriced) in their
portfolio.

We need a dedicated secondary market data provider backed by public Portfolio Personal
Inversiones (PPI) quote listings, cached daily, scoped strictly to Argentine Bonds and
Mutual Funds.

## Scope

### In Scope
- Adapter `PpiMarketDataProvider` that fetches and parses public Next.js quote pages
  from PPI (`/Cotizaciones/Bonos` and `/Cotizaciones/SupermercadoFCI`).
- Daily caching strategy (in-memory + fallback TTL/date-based file cache) so pages are
  queried at most once per calendar day or on cache expiry, avoiding repeated external calls.
- Composite provider (`CompositeMarketDataProvider` or fallback chain):
  - Checks PPI for Argentine Bonds and mapped FCIs.
  - Falls back to `YFinanceMarketDataProvider` for stocks, CEDEARs, ETFs, crypto, etc.
- Alias resolution table for FCI tickers: maps user broker tickers (e.g., `AL.DIVER.A`)
  to official PPI fund names (e.g., `Allaria Diversificado Clase A`).
- Currency normalization: maps PPI currency IDs (`10000` -> `ARS`, `22013`/`10001` -> `USD`).
- Historical series gracefully returns empty (bonds/FCI only provide current daily NAV/closing quote).
- Unit and integration tests covering parsing, alias resolution, cache expiry, and error tolerance.

### Out of Scope
- Scraping stocks or CEDEARs from PPI (Yahoo Finance handles them).
- Intraday high-frequency or streaming quotes for bonds/FCI (they update once daily at market close).
- Order execution or automated trading via PPI API.

## Capabilities

### Modified Capabilities
- `financial-domain-api`: `GET /api/v1/analysis/{ticker}` now succeeds with price and
  currency for local bonds (e.g. `AE38`) and mutual funds (e.g. `AL.DIVER.A`).
- `containerized-deployment`: no new external system dependencies; uses standard
  standard-library / existing python HTTP tools (`urllib.request` or `httpx`/`requests`).

## Approach

1. **Parser**: Fetch HTML, extract `<script id="__NEXT_DATA__">`, parse JSON payload.
   Read `pageProps.instruments` for both `/Cotizaciones/Bonos` and `/Cotizaciones/SupermercadoFCI`.
2. **Cache**: Keep an in-memory dictionary `ticker -> QuoteSnapshot` stamped with current `date`.
   Refresh only when empty, expired, or on calendar date rollover.
3. **FCI Alias Dictionary**: Store configurable mapping for known abbreviations (`AL.DIVER.A`, etc.).
4. **Fallback Chain**: `CompositeMarketDataProvider` tries PPI first if the ticker is
   recognized as a local bond or mapped FCI, otherwise delegates to `yfinance`. If PPI fails
   or network is down, logs an advisory and delegates to `yfinance`.
