# Read-Only Financial Agent Specification

## ADDED Requirements

### Requirement: Bounded agent execution

The agent runtime MUST bound every request with a timeout, MUST retry only transient provider failures within a configured limit, and MUST expose the elapsed time of each run, so that an unresponsive provider cannot block a request indefinitely.

#### Scenario: Provider exceeds the timeout

- GIVEN a provider does not answer within the configured timeout
- WHEN the agent processes a request
- THEN the request ends with an unavailable-data outcome within the bound
- AND no price, signal or portfolio value is invented

#### Scenario: Transient failure is retried within the bound

- GIVEN a provider fails transiently once
- WHEN the agent processes a request
- THEN the call is retried within the configured limit
- AND the elapsed time of the run is recorded

#### Scenario: Retry limit is reached

- GIVEN a provider keeps failing
- WHEN the agent exhausts its configured retries
- THEN the request ends with an explicit failure outcome
- AND it does not retry without bound
