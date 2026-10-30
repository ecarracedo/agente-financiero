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
