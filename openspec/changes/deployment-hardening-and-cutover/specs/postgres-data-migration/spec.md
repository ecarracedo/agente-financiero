# PostgreSQL Data Migration Specification

## ADDED Requirements

### Requirement: Cutover parity gate

Before the legacy runtime is retired, the migration MUST be shown to preserve financial parity and to be reversible, and the result MUST be recorded as an artifact that the retirement depends on.

#### Scenario: Parity and restore are demonstrated

- GIVEN a current copy of the legacy data
- WHEN the parity gate runs
- THEN counts and balances are reconciled per entity
- AND a backup is taken and a restore is demonstrated
- AND the acceptance and the rollback path are recorded

#### Scenario: Discrepancy blocks the cutover

- GIVEN reconciliation reports a discrepancy
- WHEN the gate is evaluated
- THEN the cutover is not approved
- AND the legacy runtime stays in place
- AND the discrepancy is recorded for follow-up

#### Scenario: Write freeze during the gate

- GIVEN the parity gate is being executed
- WHEN the comparison runs
- THEN writes to the source data are stopped for the duration
- AND the source data is not modified
