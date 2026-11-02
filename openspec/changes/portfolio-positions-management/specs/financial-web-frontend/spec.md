# Delta for Financial Web Frontend

## ADDED Requirements

### Requirement: Editable position broker and asset type

"Posiciones en Cartera" MUST let the user change the broker and the asset type of an existing position inline, without leaving the portfolio workspace, and MUST reflect the new value immediately.

- The broker and asset-type cells MUST be editable selectors.
- Selecting a new value MUST show the new value immediately, before the reload finishes.
- If the update fails, the control MUST revert to the value the backend still holds.
- A stored value that the catalog no longer offers MUST stay visible and selected, instead of rendering an empty selector.
- The asset-type column MUST be titled "Activo".

#### Scenario: Change a position asset type

- GIVEN a portfolio row for `ALUA.BA` with asset type "Acciones"
- WHEN the user selects "Cedear" in the row's selector
- THEN the selector shows "Cedear" immediately
- AND the position is persisted with that asset type

#### Scenario: Stored value missing from the catalog

- GIVEN a catalog that no longer contains "Acciones"
- AND a position whose stored asset type is "Acciones"
- WHEN the row is rendered
- THEN the selector shows "Acciones"
- AND no broker or asset-type selector is left blank

#### Scenario: Failed update reverts the control

- GIVEN a portfolio row whose update request fails
- WHEN the user selects a different broker
- THEN the selector returns to the broker the backend still holds

### Requirement: Configurable broker and asset-type catalog

The settings workspace MUST let the user maintain the list of brokers and the list of asset types offered in the portfolio selectors and in the quick order form.

- Both catalogs MUST persist locally and survive a reload.
- Adding or removing a catalog entry MUST update every selector that uses it.
- An empty or unreadable catalog MUST fall back to the built-in defaults rather than rendering an empty selector.
- The default catalogs MUST be `ECO`, `PPI`, `BINANCE` for brokers and `Acciones`, `Cedear`, `ETF`, `Bono`, `FCI`, `Cripto` for asset types.

#### Scenario: Add a broker from settings

- GIVEN the settings workspace is open
- WHEN the user adds the broker `COCOS`
- THEN `COCOS` appears in the broker selector of every portfolio row
- AND `COCOS` appears in the quick order broker selector

#### Scenario: Remove a catalog entry

- GIVEN a catalog containing `BINANCE`
- WHEN the user removes it
- THEN `BINANCE` is no longer offered in any selector

### Requirement: Automatic quote refresh

The portfolio holdings table MUST refresh its quotes periodically and MUST let the user trigger a refresh on demand.

- The refresh interval MUST default to 5 minutes and MUST be configurable in the settings workspace.
- The table MUST show the time remaining until the next automatic refresh.
- A manual refresh MUST restart the countdown.
- A refreshed quote MUST replace the previous one, even when the previous quote was already displayed.
- Quote requests MUST bypass the browser HTTP cache.
- A failed quote MUST be shown as unavailable rather than as a stale price presented as current.

#### Scenario: Quotes refresh on the configured interval

- GIVEN a portfolio with holdings and a 5-minute interval
- WHEN five minutes elapse
- THEN the quotes are requested again
- AND the displayed prices reflect the new response

#### Scenario: Manual refresh restarts the countdown

- GIVEN the countdown shows `04:12` before the next automatic refresh
- WHEN the user activates "Actualizar"
- THEN the quotes are requested again
- AND the countdown restarts at the full interval

### Requirement: Position performance columns

"Posiciones en Cartera" MUST show, for each position, the current price, the position total, the variation against the weighted average price, and the unrealized profit and loss.

- The weighted average price column MUST be titled "Ponderado".
- The current price column MUST be titled "Actual".
- Total MUST be quantity multiplied by the current price, labelled with the position currency.
- Variación MUST be the percentage difference between the current price and the weighted average price.
- P&L MUST be the difference between the current price and the weighted average price, multiplied by the quantity.
- When the current price is unknown, these columns MUST show "—" rather than a number.

#### Scenario: Total, variation and P&L from a live quote

- GIVEN a position of 10 units with a weighted average price of 150.25 USD
- AND a current quote of 190.00 USD
- THEN Total shows 1900.00 USD
- AND Variación shows +26.46%
- AND P&L shows +397.50 USD

#### Scenario: Missing quote is not shown as zero

- GIVEN a position whose quote could not be obtained
- WHEN the row is rendered
- THEN Total, Variación and P&L show "—"

### Requirement: Sell a position from the holdings table

Each portfolio row MUST offer a way to sell the whole position at the current quote.

- The action MUST be unavailable while the quote is unknown.
- A successful sale MUST refresh the portfolio.

#### Scenario: Sell an entire position

- GIVEN a position with a known current quote
- WHEN the user activates "Vender" on that row
- THEN a sell transaction for the full quantity is recorded at the current price
- AND the portfolio is reloaded

### Requirement: Filter the holdings table

The holdings table MUST let the user narrow the displayed positions by ticker, asset type, and broker.

- The ticker filter MUST match on a case-insensitive substring.
- The asset-type and broker filters MUST offer exactly the values present in the configurable catalog, plus an "all" option.
- When no row matches, the table MUST show a filter-specific empty state rather than the empty-portfolio message.
- Clearing the filters MUST restore the full list.

#### Scenario: Filter by asset type

- GIVEN a portfolio with positions of more than one asset type
- WHEN the user selects a single asset type
- THEN only the positions of that asset type remain visible

#### Scenario: No match

- GIVEN filters that match no position
- WHEN the table renders
- THEN it shows that there are no results for the applied filters

### Requirement: Recent transactions card

"Últimas Transacciones" MUST list the last three transactions actually recorded in the portfolio, newest first, instead of demo data.

- The card MUST request the recent transactions from the API, not hold a hardcoded list.
- The card MUST render at most three operations.
- Each row MUST show the operation type, the ticker, the quantity, the moment, the total amount with its currency, the broker and the asset type.
- The card MUST show a loading state while the request is in flight, an error message when it fails, and an empty message when no transaction exists.
- The card MUST reload when a transaction is recorded from the portfolio workspace.

#### Scenario: Three most recent operations

- GIVEN a portfolio with five recorded transactions
- WHEN the portfolio workspace renders
- THEN the card shows three rows
- AND the rows are the three most recent operations, newest first

#### Scenario: Empty portfolio history

- GIVEN a portfolio with no recorded transactions
- WHEN the card renders
- THEN it shows that there are no transactions
- AND no row is rendered

## MODIFIED Requirements

### Requirement: Portfolio starts without seeded positions

The portfolio workspace MUST start from the positions the backend reports, with no hardcoded demo holdings.

- Demo mode MUST serve an empty holdings list so the empty state is exercised.
- The empty state MUST name the table instead of rendering invented positions.

#### Scenario: Empty portfolio

- GIVEN a backend that reports no positions
- WHEN the portfolio workspace loads
- THEN no position rows are rendered
- AND the holdings area shows its empty state
