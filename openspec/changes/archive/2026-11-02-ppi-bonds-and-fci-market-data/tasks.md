# Tasks: PPI Market Data for Argentine Bonds and FCI

## 1. PPI Adapter
- [x] 1.1 Implement `PpiMarketDataProvider` with parser for `__NEXT_DATA__` on Bonos and FCI pages.
- [x] 1.2 Implement daily caching mechanism with calendar date validation and fallback on network errors.
- [x] 1.3 Add FCI alias dictionary mapping (including `AL.DIVER.A`).
- [x] 1.4 Write unit tests with mocked HTML fixtures for bonds (`AE38`, `AL30`) and FCI (`Allaria Diversificado Clase A`).

## 2. Composite Provider Integration
- [x] 2.1 Implement `CompositeMarketDataProvider` wrapping PPI and yfinance.
- [x] 2.2 Wire `CompositeMarketDataProvider` as the default market data provider in `backend/app/main.py`.
- [x] 2.3 Verify `GET /api/v1/analysis/AE38` and `GET /api/v1/analysis/AL.DIVER.A` in backend integration tests.
- [x] 2.4 Implement `search_symbols` in PPI provider (index all bonds and FCIs by ticker/name).
- [x] 2.5 Combine PPI + yfinance search results in `CompositeMarketDataProvider.search_symbols`.
- [x] 2.6 Verify search endpoint returns bond and FCI matches for `AE38`, `AL.DIVER`, `Allaria`.

## 3. Verification & Live Test
- [x] 3.1 Run full backend test suite (`pytest`).
- [x] 3.2 Verify live endpoint on docker container against real data for `AE38` and `AL.DIVER.A`.
- [x] 3.3 Verify frontend holdings table shows live prices for Bonos and FCIs.
- [x] 3.4 Verify autocomplete search returns bond and FCI matches.
