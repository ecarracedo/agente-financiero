# Financial Web Frontend Specification

## Purpose
Provide a React web interface for the financial capabilities currently exposed by the Streamlit application.

## Requirements

### Requirement: Portfolio workspace

The frontend MUST provide views for portfolio summary, holdings, valuations, gain/loss, transactions, target alerts, wishlist, bibliography, charts, opportunities, and split calculations. Monetary amounts MUST display their currency, and totals MUST be grouped by currency when no FX conversion is available.

#### Scenario: Inspect portfolio

- GIVEN the user opens the portfolio workspace
- WHEN the backend returns holdings and valuations
- THEN the frontend displays quantities, prices, values, gains/losses, categories, and brokers
- AND identifies the currency for each monetary value
- AND loading and error states are visible when applicable

#### Scenario: Record an operation

- GIVEN the operation form contains valid data
- WHEN the user confirms a purchase or sale
- THEN the frontend submits the operation and refreshes affected holdings and history
- AND a rejected operation is shown without presenting it as successful

### Requirement: Market visualization and alerts

The frontend MUST display chart-ready historical data, current price changes, target lines, transaction markers, and alert states. Users MUST be able to configure a target alert as neutral, stop-loss, buy, or sell and see its intent-specific message when triggered.

#### Scenario: View a stock chart

- GIVEN a valid ticker from the portfolio, wishlist, or search
- WHEN the user selects a period and chart mode
- THEN the corresponding price series and configured overlays are displayed

#### Scenario: Monitor target alerts

- GIVEN a holding or wishlist item has a target price
- WHEN its current price reaches the configured condition
- THEN the frontend displays the corresponding alert state
- AND unavailable market data is shown as unavailable rather than as zero
- AND values in different currencies are not visually presented as one converted total

#### Scenario: Configure a target alert intent

- GIVEN a portfolio holding with a target price
- WHEN the user selects neutral, stop-loss, buy, or sell
- THEN the selected intent is saved with the target
- AND the corresponding message is displayed when its crossing condition occurs

### Requirement: Framework independence

The frontend MUST communicate through backend contracts and MUST NOT require Streamlit or direct database access at runtime.

#### Scenario: Run without legacy UI

- GIVEN the backend and frontend containers are running
- WHEN the user opens the web application
- THEN all data requests use the backend boundary
- AND no Streamlit process is required
