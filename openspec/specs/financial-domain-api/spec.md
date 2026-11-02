# Financial Domain API Specification

## Purpose
Expose the existing financial capabilities through a backend contract independent of the presentation layer.

## Requirements

### Requirement: Portfolio and transaction operations

The system MUST expose portfolio operations for holdings, purchases, sales, transaction history, and transaction deletion while preserving the documented financial rules. Each monetary operation MUST carry an ISO currency code, and weighted averages MUST only combine values in the same currency.

#### Scenario: Record a purchase

- GIVEN a valid ticker, broker, category, quantity, price, currency, and date
- WHEN a purchase is recorded
- THEN the holding quantity and weighted purchase average are updated
- AND the transaction is available in history
- AND monetary values retain the supplied currency

#### Scenario: Record a sale

- GIVEN a position with sufficient quantity
- WHEN a sale is recorded
- THEN the holding quantity decreases by the sold quantity
- AND the remaining average purchase price is unchanged

#### Scenario: Reject an invalid sale

- GIVEN a position does not have sufficient quantity
- WHEN a sale is requested
- THEN the operation is rejected
- AND no partial transaction or holding change is persisted

### Requirement: Valuation and market analysis

The system MUST provide holdings valuation, gain/loss, historical market data, technical signals, target alerts, and chart-ready data without requiring a UI framework. Monetary totals MUST remain grouped by currency unless an explicit FX conversion is requested.

#### Scenario: Calculate valuation

- GIVEN holdings and a current market price
- WHEN valuation is requested
- THEN total value and gain/loss amount and percentage are returned

#### Scenario: Value holdings in different currencies

- GIVEN holdings denominated in more than one currency and no FX conversion request
- WHEN portfolio valuation is requested
- THEN totals are returned separately by currency
- AND amounts in different currencies are not added together

#### Scenario: Generate analysis signals

- GIVEN a ticker, current price, and historical prices
- WHEN analysis is requested
- THEN high/low and moving-average signals are returned
- AND missing historical data produces an explicit unknown result

### Requirement: Configurable target alert intent

The system MUST allow each target alert to be configured as `NEUTRAL`, `STOP_LOSS`, `BUY`, or `SELL`, and MUST emit the corresponding distinct message only when the price crosses its target in the configured direction. `NEUTRAL` MUST trigger on a crossing in either direction; `STOP_LOSS` and `BUY` MUST trigger on a downward crossing; `SELL` MUST trigger on an upward crossing. Remaining beyond a target MUST NOT repeatedly trigger the same crossing.

#### Scenario: Neutral alert crosses target either way

- GIVEN a neutral target and consecutive prices on opposite sides of the target
- WHEN the price crosses the target upward or downward
- THEN a neutral target-reached alert is emitted
- AND no buy, stop-loss, or sell message is used

#### Scenario: Directional alert uses its configured message

- GIVEN a STOP_LOSS, BUY, or SELL target alert
- WHEN consecutive prices cross the target in its configured direction
- THEN the alert emits the distinct message for its configured intent
- AND crossing in the opposite direction does not trigger it

#### Scenario: Price remains beyond a crossed target

- GIVEN an alert has triggered on a target crossing
- WHEN subsequent prices remain beyond the target on the same side
- THEN the same crossing does not repeatedly emit the alert

### Requirement: Supporting resources

The system MUST provide wishlist, bibliography, and split-calculation operations through the same backend boundary.

#### Scenario: Manage wishlist and bibliography

- GIVEN valid resource or ticker data
- WHEN an item is created, updated, listed, or removed
- THEN the requested state is persisted and returned consistently

#### Scenario: Calculate a split

- GIVEN quantity, average price, and a valid split ratio
- WHEN the projection is requested
- THEN adjusted quantity and average price are returned


### Requirement: Asset symbol search

The system MUST expose a read-only asset search that answers a free-text query with provider symbol matches, each carrying its symbol, name, exchange, and instrument type. The search MUST be bounded by a caller-supplied limit and MUST answer a provider failure with an empty result rather than an error or invented symbols.

#### Scenario: A query returns matching instruments

- GIVEN the market provider recognizes the query
- WHEN a client requests the asset search for that query
- THEN the response lists the matching symbols with their name, exchange, and instrument type

#### Scenario: A provider failure yields no matches

- GIVEN the market provider fails or returns nothing usable
- WHEN a client requests the asset search
- THEN the response is an empty list with a successful status

#### Scenario: Invalid search input is rejected

- GIVEN a blank query or a limit outside the supported range
- WHEN a client requests the asset search
- THEN the request is rejected as invalid input

### Requirement: Quote currency in market analysis

The market analysis response MUST carry the ISO currency the market provider quotes the instrument in, taken from the same provider snapshot as the current price. An instrument the provider quotes in another currency MUST NOT be reported as US dollars. When the provider offers no recognizable three-letter code, the currency MUST be reported as unknown instead of guessed.

#### Scenario: An Argentine listing reports pesos

- GIVEN a provider that quotes an Argentine listing at 4802.5 in ARS
- WHEN a client requests the market analysis for that symbol
- THEN the response carries `currency` as `ARS`
- AND the current price is unchanged

#### Scenario: A US listing reports dollars

- GIVEN a provider that quotes a US listing at 72.65 in USD
- WHEN a client requests the market analysis for that symbol
- THEN the response carries `currency` as `USD`

#### Scenario: An unusable currency code is unknown

- GIVEN a provider whose currency field is missing or not a three-letter code
- WHEN a client requests the market analysis
- THEN the response carries `currency` as `null`
- AND the response is still successful

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
