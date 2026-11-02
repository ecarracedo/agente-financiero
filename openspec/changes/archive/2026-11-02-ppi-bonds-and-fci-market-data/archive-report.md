# Archive Report: ppi-bonds-and-fci-market-data

**Change**: ppi-bonds-and-fci-market-data
**Archived**: 2026-11-02
**Verdict before archive**: PASS

## Result

`GET /api/v1/analysis/{ticker}` now returns live price and currency for Argentine Sovereign/Corporate Bonds and Local Mutual Funds (FCI) via a dedicated `PpiMarketDataProvider` that fetches structured JSON from Portfolio Personal Inversiones (PPI) public Next.js pages, cached daily. A `CompositeMarketDataProvider` delegates to PPI for local bonds and FCIs, and falls back to `YFinanceMarketDataProvider` for all other instruments.

## Verification Evidence

- Backend tests: `python -m pytest backend/tests -q` → 200 passed (7 new unit tests for PPI adapter).
- Frontend tests: `npx vitest run` → 167 passed.
- Live API on docker container:
  - `GET /api/v1/analysis/AE38` → `{"current_price":"109390","currency":"ARS","status":"UNKNOWN"}`
  - `GET /api/v1/analysis/AL.DIVER.A` → `{"current_price":"0.18","currency":"ARS","status":"UNKNOWN"}`
  - `GET /api/v1/analysis/AL30D` → `{"current_price":"53.41","currency":"USD"}`
  - `GET /api/v1/analysis/AAPL` → yfinance fallback works, full historical series returned.
- OpenAPI snapshot regenerated and checked by `backend/tests/test_openapi_snapshot.py`.
- Git commits on `dev`: (to be merged).

## Requirement Coverage

- **Local bonds quotes** — met (`AE38`, `AL30`, `AL30D`, `GD30`, etc., prices in ARS/USD as per PPI currency ID).
- **Mutual funds (FCI) quotes via alias** — met (`AL.DIVER.A` → `Allaria Diversificado Clase A`).
- **Daily caching** — met (calendar-day TTL, stale cache retained on network failure).
- **Fallback to yfinance** — met (stocks, CEDEARs, ETFs, crypto still use yfinance; historical series only via yfinance).
- **Currency normalization** — met (`10000`→`ARS`, `22013`/`10001`→`USD`).

## Known Limitations

- PPI public pages only expose current daily quote; no historical series for bonds/FCI (returns empty, which is documented).
- `search_symbols` returns empty for PPI (yfinance handles search).
- The alias dictionary is hardcoded with `DEFAULT_FCI_ALIASES`; users cannot yet edit it from Settings.
- `status` remains `UNKNOWN` for PPI quotes because the analysis endpoint derives status from historical series availability (which PPI does not provide). The price and currency are correct.

## Canonical Specs Updated

- `openspec/specs/financial-domain-api/spec.md`: 1 added requirement "Local bonds and mutual funds quotes".