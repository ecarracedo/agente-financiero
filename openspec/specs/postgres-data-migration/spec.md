# PostgreSQL Data Migration Specification

## Purpose
Move financial data from the current SQLite database to PostgreSQL without loss, duplication, or destructive source changes.

## Requirements

### Requirement: Reproducible migration

The migration process MUST be repeatable, transactional, and safe to run against a preserved copy of `finance.db`.

#### Scenario: Migrate valid source data

- GIVEN a readable SQLite database containing portfolio, transaction, wishlist, and bibliography data
- WHEN the migration is executed
- THEN equivalent PostgreSQL records are created
- AND a reconciliation report contains source and destination counts

#### Scenario: Repeat a completed migration

- GIVEN the same source and a previously migrated destination
- WHEN the migration is executed again
- THEN it does not create duplicate business records
- AND the reconciliation result remains consistent

### Requirement: Validation and rollback

The migration MUST validate required fields, relationships, quantities, dates, and numeric values before accepting the destination as ready.

#### Scenario: Reject invalid source data

- GIVEN source data fails validation
- WHEN migration is attempted
- THEN the destination transaction is rolled back
- AND the original SQLite source remains unchanged

#### Scenario: Restore after discrepancy

- GIVEN reconciliation detects a mismatch after migration
- WHEN the operator invokes rollback or restore
- THEN the destination can be returned to its last valid backup
- AND the source copy remains available for another attempt

### Requirement: Explicit currency mapping for legacy rows

Because the SQLite schema does not store currency, migration MUST require an explicit source-to-currency mapping for legacy monetary records and MUST NOT infer currency silently.

#### Scenario: Legacy currency mapping is missing

- GIVEN a legacy row has no configured currency mapping
- WHEN migration validation runs
- THEN the row is reported as unresolved
- AND migration does not mark the destination ready

#### Scenario: Legacy currency mapping is provided

- GIVEN every legacy monetary row has an explicit currency mapping
- WHEN migration runs
- THEN the currency is stored with the migrated financial values
- AND reconciliation reports mapped and unresolved records

### Requirement: PostgreSQL operational safety

The system MUST support schema versioning, persistent storage, backups, health checks, and credentials supplied outside application images.

#### Scenario: Start a healthy environment

- GIVEN valid database configuration and a persistent volume
- WHEN the backend environment starts
- THEN schema state is checked before serving requests
- AND health status distinguishes readiness from failure
