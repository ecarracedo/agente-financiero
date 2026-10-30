# Delta for Financial Web Frontend

## ADDED Requirements

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

