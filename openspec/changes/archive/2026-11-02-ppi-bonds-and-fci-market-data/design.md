# Design: PPI Market Data for Argentine Bonds and FCI

## Context

Yahoo Finance lacks coverage for Argentine Sovereign/Corporate Bonds (`AE38`, `AL30`,
`GD30`) and Local Mutual Funds (`FCI`). Users holding these assets in their portfolio
currently see `—` for market price, total, and variation.
Portfolio Personal Inversiones (PPI) publishes daily public quote tables with Next.js
server-side rendered JSON (`__NEXT_DATA__`) containing clean prices and currencies for
~150 bonds and ~770 mutual funds.

## Decisions

### D1. Scope strictly to Argentine Bonds and FCI
PPI quotes for CEDEARs and local equities (`ALUA.BA`, `PAMP.BA`, `SPY.BA`) are ignored.
Those remain owned by `YFinanceMarketDataProvider` which also provides intraday updates,
currency tags, and historical series.

### D2. Extract structured JSON from `__NEXT_DATA__`
Rather than brittle HTML table scraping or regex over markup, we extract the `<script
id="__NEXT_DATA__">` tag content and parse it via `json.loads()`.
`props.pageProps.instruments` contains exact numeric values:
- Bonds: `ticker` (string, e.g. `AE38`), `lastPrice` (float/int), `currency.id`
  (`10000` -> `ARS`, `22013`/`10001` -> `USD`).
- FCI: `name` (string, e.g. `Allaria Diversificado Clase A`), `lastPrice` (float,
  cuotaparte), `currency.id` (`10000` -> `ARS`, `22013`/`10001` -> `USD`).

### D3. Once-a-day / TTL caching
Bonds and mutual funds NAV/closing prices update once at the end of each business day.
`PpiMarketDataProvider` checks an internal cache timestamp:
- If cached today (same calendar date), return quote directly from memory.
- If expired or empty, perform a single HTTP GET for `/Cotizaciones/Bonos` and
  `/Cotizaciones/SupermercadoFCI`, parse both, and update the cache.
- On network error or timeout, log an advisory and use stale cache if available, or
  return `None`.

### D4. Explicit FCI Alias Dictionary
Brokers represent mutual funds with short symbols (e.g. `AL.DIVER.A`), while PPI lists
them by their full public prospectus name (`Allaria Diversificado Clase A`).
An alias dictionary normalizes broker tickers into the PPI fund name:
```python
DEFAULT_FCI_ALIASES = {
    "AL.DIVER.A": "Allaria Diversificado Clase A",
}
```
Matching is case-insensitive and stripped.

### D5. Composite / Fallback Provider
A new `CompositeMarketDataProvider` implements `MarketDataProviderPort`:
1. Check if the ticker is recognized by `PpiMarketDataProvider` (a bond symbol or mapped FCI alias).
2. If yes, query PPI provider for quote.
3. If no or if PPI returns `None`, delegate to `YFinanceMarketDataProvider`.
4. `get_historical_series()` delegates to `yfinance` (PPI does not expose multi-month series on public quote pages).
5. `search_symbols()` aggregates matches or delegates to `yfinance`.
