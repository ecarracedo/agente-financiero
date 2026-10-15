# Legacy Cutover Specification

## Purpose
Retire the Streamlit/SQLite/Peewee runtime only after financial parity has been demonstrated and reversed, and document how the resulting stack is set up, operated and rolled back.

## Requirements

### Requirement: Documented operation

The repository MUST document how to set up, configure, migrate, operate and roll back the deployed stack, using the variables the manifests actually read.

#### Scenario: Follow the documentation from a clean checkout

- GIVEN a clean checkout with no prior knowledge of the project
- WHEN a developer follows the documented setup
- THEN the stack starts using only the documented variables
- AND the migration path and the rollback path are described
- AND no step requires reading the source code to discover a required variable

### Requirement: Gated retirement

The legacy runtime MUST NOT be removed until the parity gate is approved and recorded, and MUST remain runnable until then. A relocation of data MUST be preserved according to the recorded decision.

#### Scenario: Retire after approval

- GIVEN the parity gate has been executed and its approval recorded
- WHEN the legacy runtime is removed
- THEN no production image or dependency manifest requires Streamlit, Peewee or SQLite
- AND the data preserved for the user follows the recorded decision

#### Scenario: Gate not approved

- GIVEN the parity gate has not been approved
- WHEN the retirement is considered
- THEN the legacy runtime stays in place and remains runnable
- AND no legacy file or dependency is deleted
