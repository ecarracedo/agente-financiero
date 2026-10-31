# Frontend Dev Harness Specification

## Purpose

Make the frontend runnable and testable without a live backend. Today every workspace except the split calculator fetches on mount, so without a backend a reviewer only ever sees error states, and the tests stub each feature API module instead of the network boundary: adding one request forces edits across many test files.

## Requirements

### Requirement: Demo data mode

The frontend MUST be able to serve every workspace from a deterministic local dataset with no backend process running.

#### Scenario: Try the app without a backend

- GIVEN demo data mode is enabled
- WHEN the development server starts
- THEN every workspace renders populated data
- AND no backend process is required

### Requirement: Network-level test stubbing

Frontend tests MUST stub the network boundary instead of mocking each feature API module, so that adding a request to a workspace does not require editing unrelated test files.

#### Scenario: A new request does not break unrelated tests

- GIVEN a workspace under test
- WHEN that workspace gains a new backend request
- THEN the shared request handlers cover it
- AND the existing tests pass without new per-file module mocks

#### Scenario: An unhandled request surfaces

- GIVEN a test that triggers a request with no handler
- WHEN the request is made
- THEN the test surfaces it instead of silently failing

### Requirement: Shared fixtures and a single render helper

Test data MUST be declared once and reused, and one helper MUST provide the routing and providers a workspace needs.

#### Scenario: Fixtures are reused

- GIVEN two test files that need the same payload
- WHEN they build their data
- THEN both import the same fixture

#### Scenario: One render path

- GIVEN a workspace test
- WHEN it renders the workspace
- THEN it uses the shared helper
- AND it does not hand-mock the application shell
