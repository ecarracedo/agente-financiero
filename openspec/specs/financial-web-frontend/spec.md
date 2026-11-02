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

### Requirement: Portfolio starts without seeded positions

The portfolio workspace MUST start from the positions the backend reports, with no hardcoded demo holdings.

- Demo mode MUST serve an empty holdings list so the empty state is exercised.
- The empty state MUST name the table instead of rendering invented positions.

#### Scenario: Empty portfolio

- GIVEN a backend that reports no positions
- WHEN the portfolio workspace loads
- THEN no position rows are rendered
- AND the holdings area shows its empty state

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

### Requirement: Visual system

The frontend MUST render every workspace through one styling system built on Tailwind CSS 4 and Tremor components copied into the repository, MUST NOT render interactive or data views as unstyled raw HTML, and MUST depend on exactly one Recharts major.

#### Scenario: Styled workspace

- GIVEN the frontend is running
- WHEN the user opens any workspace
- THEN it renders through the shared styling system
- AND no view falls back to unstyled raw HTML

#### Scenario: One chart major

- GIVEN the installed dependencies
- WHEN the bundle is built
- THEN exactly one Recharts major is present
- AND the market chart still renders its target line and its transaction markers

### Requirement: Deep-linkable navigation

Each workspace MUST have its own URL and MUST be restored when that URL is opened directly. The alerts view MUST be reachable without passing through the market workspace.

#### Scenario: Deep link restores the workspace

- GIVEN a URL identifying a workspace
- WHEN it is opened directly in the browser
- THEN that workspace renders with no manual navigation

#### Scenario: Alerts are a first-class destination

- GIVEN the user wants to monitor alerts
- WHEN the user navigates
- THEN alerts are reachable without opening the market workspace

### Requirement: Preserved workspace state

The frontend MUST NOT discard data the user has entered when navigating between workspaces.

#### Scenario: Entered data survives navigation

- GIVEN a workspace holding entered form data
- WHEN the user leaves it and returns
- THEN the entered data is still present

### Requirement: Per-field operation feedback

A validation error MUST be associated with the field that caused it and MUST be exposed to assistive technology. A rejected operation MUST NOT be presented as a success, and a query with missing required input MUST report what is missing instead of failing silently.

#### Scenario: Field error is announced

- GIVEN invalid input in an operation form
- WHEN the user submits it
- THEN the offending field displays its error
- AND that field is marked invalid
- AND the message is associated with the field for assistive technology

#### Scenario: Rejected operation is not success

- GIVEN the backend rejects an operation
- WHEN the rejection returns
- THEN an error is shown
- AND the entered data is preserved
- AND no success message is shown
- AND 409 and 404 responses are never presented as success

#### Scenario: Missing input is reported

- GIVEN a filtered query whose required value is missing
- WHEN the user triggers it
- THEN the frontend reports what is missing

### Requirement: Complete view states

Every data view MUST render loading, empty and error states that are distinguishable from each other, and every destructive action MUST require confirmation before its request is sent.

#### Scenario: Empty state is explicit

- GIVEN a data view with no records
- WHEN it renders
- THEN an empty state specific to that view is shown
- AND it is distinguishable from the loading state

#### Scenario: Destructive action is confirmed

- GIVEN a delete action on any record
- WHEN the user triggers it
- THEN confirmation is required before the request is sent
- AND cancelling sends no request

### Requirement: Financial value presentation

Monetary values MUST identify their currency, gains and losses MUST be distinguishable by more than colour alone, and success feedback MUST NOT outlive the action it describes.

#### Scenario: Gain and loss are distinguishable

- GIVEN a gain and a loss
- WHEN they are rendered
- THEN each carries a sign and a non-colour cue
- AND the distinction does not depend on colour alone

#### Scenario: Success feedback is scoped

- GIVEN a success message left by a previous action
- WHEN a new action starts or the user navigates
- THEN the stale message is gone



### Requirement: Transaction price autofill and defaults

When recording a transaction, the frontend SHOULD query current market data for the specified ticker and autocomplete the unit price with the latest observed quote. The unit price field MUST remain editable by the user. When creating a new transaction, the form MUST provide valid default values for timestamp, currency, broker, and category unless already specified.

#### Scenario: Price is autocompleted for a recognized ticker

- GIVEN a user entering an operation in the transaction form
- WHEN a valid ticker is specified
- THEN the frontend queries the market analysis endpoint
- AND populates the unit price field with the observed quote
- AND the user is able to edit or overwrite the price

#### Scenario: Defaults are provided for new transactions

- GIVEN an empty transaction form
- WHEN the form is rendered
- THEN timestamp defaults to current date and time
- AND currency defaults to USD
- AND broker and category receive sensible defaults

### Requirement: Dashboard quick order execution

The portfolio workspace MUST allow users to execute a buy or sell transaction directly from the quick order dashboard card and MUST immediately refresh the portfolio holdings, summary metrics, and valuations upon successful execution.

#### Scenario: Execute order from dashboard card

- GIVEN the user is on the portfolio workspace
- WHEN the user selects an asset, quantity, and clicks register transaction
- THEN the transaction is submitted to the backend
- AND on success, the holdings and portfolio summary immediately reflect the updated position
- AND a confirmation indicator is displayed

### Requirement: Asset search in the order ticket

The quick order ticket MUST let the user find an instrument by typing free text and MUST offer provider-backed symbol suggestions. Selecting a suggestion MUST fill the ticker and its display name, and typing a symbol with no suggestion MUST remain a valid input.

#### Scenario: Suggestions appear while typing

- GIVEN the quick order ticket with an empty ticker field
- WHEN the user types at least two characters of an instrument name or symbol
- THEN the frontend queries the asset search endpoint after a short debounce
- AND the matching symbols, names, and exchanges are listed

#### Scenario: Selecting a suggestion fills the ticket

- GIVEN a suggestion list for the typed query
- WHEN the user picks one suggestion with the mouse or with the keyboard
- THEN the ticker field holds the suggested symbol
- AND the instrument name is displayed under the field
- AND the unit price is refreshed for that symbol

#### Scenario: A symbol without suggestions is still usable

- GIVEN a typed symbol the provider does not suggest
- WHEN the user submits the order
- THEN the typed symbol is submitted unchanged
- AND no error is raised for the missing suggestion


### Requirement: Transaction currency follows the instrument

Both transaction entry points MUST record a transaction in the currency the instrument is actually quoted in, as reported by the market analysis for that symbol. The currency MUST be visible in the order ticket next to the unit price and the estimated total. When the quote reports no currency, the ticket MUST fall back to US dollars, and the currency field MUST remain editable in the full operation form.

#### Scenario: The quick order ticket records pesos for an Argentine listing

- GIVEN the quick order ticket and a symbol quoted in ARS
- WHEN the quote returns a current price with its currency
- THEN the ticket shows that currency beside the price and the estimated total
- AND the submitted transaction carries that same currency

#### Scenario: The operation form adopts the quote currency

- GIVEN the operation form with its dollar default
- WHEN the user requests the quote for a symbol quoted in ARS
- THEN the currency field holds ARS
- AND the user can still overwrite it before submitting

#### Scenario: An unknown quote currency falls back to dollars

- GIVEN a symbol whose quote reports no currency
- WHEN the user submits the ticket
- THEN the transaction is recorded in USD

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
