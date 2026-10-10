# Containerized Deployment Specification

## Purpose
Provide reproducible local development and a deployable environment compatible with Coolify.

## Requirements

### Requirement: Development environment

The project MUST provide a development Compose environment containing the frontend, backend, and PostgreSQL services with isolated persistent test data.

#### Scenario: Start development stack

- GIVEN Docker and Compose are available
- WHEN the developer starts the development environment
- THEN frontend, backend, and PostgreSQL become reachable through documented endpoints
- AND code changes can be developed with the configured reload workflow

#### Scenario: Service dependency failure

- GIVEN PostgreSQL is unavailable
- WHEN the backend starts
- THEN readiness reports failure clearly
- AND the frontend shows a usable backend error state

### Requirement: Coolify deployment

The production container configuration MUST be deployable by Coolify using external environment variables, health checks, private database networking, and persistent PostgreSQL storage.

#### Scenario: Deploy a healthy release

- GIVEN production secrets, domain configuration, and persistent storage are supplied
- WHEN Coolify deploys the release
- THEN the frontend and backend become healthy
- AND PostgreSQL is not publicly exposed

#### Scenario: Restart services

- GIVEN the deployed services are restarted
- WHEN containers return to ready state
- THEN application data remains available from persistent PostgreSQL storage
- AND secrets are not stored in the image

### Requirement: Legacy runtime removal

The final production runtime MUST NOT require Streamlit, SQLite, or Peewee.

#### Scenario: Run without legacy dependencies

- GIVEN the production images are built from the final dependency manifests
- WHEN the application starts
- THEN no Streamlit process, SQLite file, or Peewee import is required
