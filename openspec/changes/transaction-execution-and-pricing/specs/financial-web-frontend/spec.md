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
