# Portfolio Test Infrastructure Specification

## Purpose
Define a reproducible and isolated test environment for portfolio behavior without changing production financial rules or touching the user's real database.

## Requirements

### Requirement: Isolated database state

The test suite MUST execute portfolio tests against a temporary SQLite database and MUST create the required tables before each test context. Tests MUST NOT read from or write to the repository's `finance.db`.

#### Scenario: Portfolio test starts with clean state

- GIVEN a portfolio test is starting
- WHEN the test creates or queries portfolio data
- THEN it uses an isolated temporary database with the required tables
- AND no data is read from the repository database

#### Scenario: Test cleanup restores isolation

- GIVEN a test has created portfolio items and transactions
- WHEN the test finishes, including after a failure
- THEN its database connection and temporary data are released
- AND a subsequent test starts without the previous test's records

### Requirement: Existing portfolio contract coverage

The suite MUST verify the current portfolio contract: purchases update quantity and weighted average, sales reduce quantity without changing the remaining position's average price, and valuation uses the current market price.

#### Scenario: Weighted average after multiple purchases

- GIVEN no position exists for a ticker and broker
- WHEN the test records purchases at different prices
- THEN the resulting quantity equals the sum of purchases
- AND the average equals the weighted purchase average

#### Scenario: Sale preserves remaining average

- GIVEN a position with quantity and average purchase price
- WHEN the test records a sale below or above that average
- THEN the quantity decreases by the sold amount
- AND the remaining average purchase price is unchanged

#### Scenario: Valuation uses the market provider contract

- GIVEN a holding exists and the market provider returns a known current price
- WHEN the portfolio valuation is requested
- THEN total value and gain/loss are calculated from that price
- AND the test replaces the actual provider at its real import path

### Requirement: Reproducible test execution

The suite MUST use the public or intentionally supported portfolio API and MUST pass repeatedly with the same results in a clean environment. Tests MUST NOT depend on monkey-patching methods that production does not provide.

#### Scenario: Full suite passes repeatedly

- GIVEN the project dependencies are installed
- WHEN `pytest` is run twice in succession
- THEN every test passes both times
- AND the result does not depend on execution order or prior database contents

#### Scenario: Invalid test assumption is removed

- GIVEN a test refers to a missing method or obsolete module path
- WHEN the test suite is updated
- THEN it uses an existing supported API or a documented test fixture
- AND it no longer fails because of the obsolete reference
