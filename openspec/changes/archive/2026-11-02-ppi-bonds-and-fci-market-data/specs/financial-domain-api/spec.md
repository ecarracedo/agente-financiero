# Delta for Financial Domain API

## ADDED Requirements

### Requirement: Local bonds and mutual funds quotes

The market analysis endpoint `GET /api/v1/analysis/{ticker}` MUST return current price
and currency for Argentine bonds and mutual funds not available on international data
providers.

- The provider MUST support bond tickers (e.g. `AE38`, `AL30`, `AL30D`, `GD30`).
- The provider MUST support mutual funds by official name or registered broker alias
  (e.g. `AL.DIVER.A`).
- The quote MUST report the correct currency (`ARS` for peso listings, `USD` for dollar
  listings).
- External data for bonds and mutual funds MUST be fetched at most once per calendar day
  and cached.
- An unavailable external page MUST fall back gracefully without crashing or blocking
  other tickers.

#### Scenario: Quote an Argentine sovereign bond

- GIVEN a position holding bond `AE38`
- WHEN the client requests `GET /api/v1/analysis/AE38`
- THEN the response reports status `OK`
- AND `current_price` reflects the latest closing price
- AND `currency` is `ARS`

#### Scenario: Quote a mutual fund via broker alias

- GIVEN a mutual fund alias `AL.DIVER.A` mapped to `Allaria Diversificado Clase A`
- WHEN the client requests `GET /api/v1/analysis/AL.DIVER.A`
- THEN the response reports status `OK`
- AND `current_price` reflects the fund's latest share value (cuotaparte)
- AND `currency` is `ARS`

#### Scenario: International ticker still routes to Yahoo Finance

- GIVEN an international stock `AAPL` or Cedear `ALUA.BA`
- WHEN the client requests analysis
- THEN the quote is resolved via the primary provider (`yfinance`)
