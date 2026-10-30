# Delta for Financial Domain API

## ADDED Requirements

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
