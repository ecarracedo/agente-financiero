# Containerized Deployment Specification

## ADDED Requirements

### Requirement: API access control

The published deployment MUST NOT return financial data to an unauthenticated client outside the deployment network. The API MAY be reached through the frontend proxy, which is the only supported entry point.

#### Scenario: Unauthenticated access to the API

- GIVEN the production stack is running
- WHEN a client outside the deployment network calls an `/api/v1` route directly
- THEN the request does not reach the API
- AND no financial data is returned

#### Scenario: Access through the frontend origin

- GIVEN the production stack is running
- WHEN the frontend calls an `/api/v1` route through its own origin
- THEN the request reaches the API and returns the expected data

### Requirement: Deployment validation

The deployment MUST be validated end-to-end against the Compose stack before the legacy runtime is retired, covering the main user journey, a service restart and a dependency failure.

#### Scenario: Main journey against the deployed stack

- GIVEN the Compose stack is running with production-like configuration
- WHEN the end-to-end suite drives the main journey
- THEN portfolio, transactions, market analysis and alerts are exercised through the browser
- AND the run fails when any step is unreachable

#### Scenario: Restart preserves data

- GIVEN the stack holds financial data
- WHEN its services are restarted
- THEN the data is still available
- AND the application returns to ready state

#### Scenario: Dependency failure is visible

- GIVEN PostgreSQL is unavailable
- WHEN the frontend is opened
- THEN the user sees a backend error state
- AND no stale or fabricated value is presented as current

### Requirement: Proxy upstream re-resolution

The frontend proxy MUST resolve the backend address at request time, so that a recreated backend container with a new address does not receive traffic at a stale address.

#### Scenario: Backend recreated with a different address

- GIVEN the proxy is running and serving API traffic
- WHEN the backend container is recreated and obtains a different address
- THEN proxied API requests still reach the backend
- AND no request is answered by a stale upstream

### Requirement: Project-interpreter quality gates

The declared quality gates MUST run in the Python interpreter the repository pins, and MUST limit their inspection to project sources.

#### Scenario: Run the declared gates

- GIVEN a developer follows the documented setup
- WHEN the type-check and formatting gates run
- THEN they execute in the pinned interpreter
- AND they do not inspect scratch or vendored trees
