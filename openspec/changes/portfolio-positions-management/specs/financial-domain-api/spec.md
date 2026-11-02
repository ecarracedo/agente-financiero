# Delta for Financial Domain API

## ADDED Requirements

### Requirement: Update a position's broker and asset type

The API MUST let a client change the broker or the asset type of an existing position without altering its quantity, weighted average price, or currency.

- `PUT /api/v1/portfolio/{ticker}` MUST accept an optional `broker` and an optional `category` in the body.
- The position to update MUST be identified by the `broker` and `category` query parameters, because those are part of the position's business identity.
- The response MUST be the updated position.
- An unknown position MUST answer `404`.

#### Scenario: Change only the asset type

- GIVEN a position `ALUA.BA` held in `ECO` with asset type `Acciones`
- WHEN the client sends `PUT /api/v1/portfolio/ALUA.BA?broker=ECO&category=Acciones` with `{"category": "Cedear"}`
- THEN the response carries asset type `Cedear`
- AND the quantity, weighted average price and currency are unchanged

#### Scenario: Unknown position

- GIVEN no position matches the identity in the query parameters
- WHEN the client sends the update
- THEN the API answers `404`

### Requirement: List recent transactions across the portfolio

`GET /api/v1/transactions` MUST be able to return the most recent operations of the whole portfolio, newest first, without naming a ticker.

- Supplying both `ticker` and `broker` MUST keep returning that asset's chronological history.
- Supplying neither MUST return the most recent operations across every asset, newest first.
- The optional `limit` parameter MUST bound the returned rows, defaulting to 50 and accepting 1 to 200.
- Supplying only one of `ticker` and `broker` MUST answer `422`.
- Each row MUST carry the transaction identifier, ticker, broker, asset type, operation type, quantity, unit price, currency and timestamp.

#### Scenario: Recent operations without a ticker

- GIVEN transactions recorded for `AAPL` and `MSFT`
- WHEN the client sends `GET /api/v1/transactions?limit=2`
- THEN the response carries the two most recent operations
- AND the first row is the newest one

#### Scenario: Partial filter is rejected

- GIVEN a transaction history
- WHEN the client sends `GET /api/v1/transactions?ticker=AAPL` without `broker`
- THEN the API answers `422`
