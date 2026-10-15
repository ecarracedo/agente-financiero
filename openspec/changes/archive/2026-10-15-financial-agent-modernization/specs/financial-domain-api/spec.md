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
