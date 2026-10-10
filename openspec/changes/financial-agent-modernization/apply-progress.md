# Apply Progress: Modernización full-stack del agente financiero

**Mode**: Strict TDD
**Status**: In progress

## Completed Tasks

- [x] 1.1 Recorded single-user deployment, per-operation ISO currency, Decimal precision, yfinance as initial provider, and a read-only analysis agent.
- [x] 1.2 Added legacy behavior characterization and extracted the split projection to a tested pure helper.
- [x] 2.1 Added backend manifest, FastAPI app factory, health route, and OpenAPI test.
- [x] 2.2 Added immutable Decimal portfolio rules and backend split projection.
- [x] 2.3 Added SQLAlchemy models and repositories for positions, transactions, wishlist, and bibliography; repository methods leave transaction ownership to callers.
- [x] 2.4 Added SQLAlchemy engine/readiness, Alembic initial schema, Compose PostgreSQL/backend services and `.env.example`; verified a live PostgreSQL migration and readiness via host Docker.
- [x] 3.1 Added transactional portfolio use cases for purchases, sales, history, and transaction deletion/rebuild using a caller-owned SQLAlchemy unit of work.
- [x] 3.2 Added Decimal valuation grouped by currency, technical analysis with explicit unknown states, yfinance adapter, and persistent configurable portfolio/wishlist alert intents with crossing suppression.
- [x] 3.3 Added application use cases for wishlist CRUD, bibliography resources, and Decimal split projections.
- [x] 3.4 Closed the `/api/v1` HTTP contract: canonical Decimal serialization (`format_money` → 2dp ROUND_HALF_UP; `format_quantity` → canonical unbounded) and dedicated Pydantic response schemas wired as `response_model` on every route; fixed the blocking gate debts (unit-of-work factory typed as `PortfolioUnitOfWorkPort`, setuptools packages `backend.app.application`/`backend.app.api`, ruff F401 in `test_api.py`). Storage `Numeric(30,10)` and domain arithmetic unchanged.
- [x] 4.1 Added a read-only migration dry-run reader/validator in `backend/app/adapters/migration/` (`source.py` opens `file:<path>?mode=ro`; `validation.py` with explicit, never-inferred currency mapping; `report.py` with `ValidationReport.ready`). New `verify/verify_migration_dry_run.py` (gitignored scratch) reproduces counts without touching source/destination.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | N/A (decision capture) | Structural | N/A | N/A | Decisions recorded | N/A | N/A |
| 1.2a | `tests/test_domain_characterization.py` | Unit | ✅ 4 passed | Approval tests for current behavior | ✅ 5 passed | Rebuild, missing tx, empty history, ranges, averages | ➖ Characterization only |
| 1.2b | `tests/test_calculations.py` | Unit | ✅ 4 passed | ✅ ImportError before helper | ✅ 2 passed | Forward 2:1 and reverse 1:4 | ✅ Helper wired to UI |
| 2.1 | `backend/tests/test_health.py` | Unit/API | ✅ 11 passed | ✅ ImportError before app package | ✅ 2 passed | Body and OpenAPI route | ➖ None needed |
| 2.2a | `backend/tests/test_portfolio_domain.py` | Unit | ✅ 11 passed | ✅ ImportError before domain package | ✅ 7 passed | New/existing purchase, currencies, partial/full sale, oversell | ✅ Immutable pure operations |
| 2.2b | `backend/tests/test_calculations.py` | Unit | ✅ 11 passed | ✅ ImportError before calculation module | ✅ 2 passed | Forward 2:1 and reverse 1:4 | ➖ Pure calculation |
| 2.3a | `backend/tests/test_persistence.py` | Unit/integration adapter | ✅ 22 passed | ✅ ImportError before models/repository | ✅ 3 passed | Decimal round-trip, ordered history, caller rollback | ✅ No repository commits |
| 2.3b | `backend/tests/test_resource_persistence.py` | Unit/integration adapter | ✅ 26 passed | ✅ ImportError before resource repository | ✅ 2 passed | Wishlist target CRUD and bibliography metadata CRUD | ✅ Shared transaction fixture |
| 2.3c | `backend/tests/test_project_manifest.py` | Structural/unit | N/A | ✅ Missing nested packages | ✅ Passed after manifest update | Domain and persistence packages included | ➖ Manifest only |
| 2.4a | `backend/tests/test_database_runtime.py` | Unit/config | ✅ 28 passed | ✅ Missing readiness/Compose config | ✅ 4 passed | DB-up/down, private DB, migrations-before-server | ✅ Readiness separate from liveness |
| 2.4b | `backend/tests/test_alembic.py` | Integration with SQLite substitute | ✅ 28 passed | ✅ Missing Alembic config | ✅ 2 passed | Clean schema and environment URL precedence | ⚠️ PostgreSQL server unavailable |
| 2.4c | `backend/tests/test_database_engine.py` | Unit/config | ✅ 32 passed | ✅ DATABASE_URL-only implementation rejected DB_* config | ✅ 1 passed | Reserved password characters | ✅ URL construction separated from driver import |
| 2.4d | `backend/tests/test_alembic_configuration.py` | Unit/config | ✅ 35 passed | ✅ ImportError before required URL helper | ✅ 4 passed with Alembic tests | Configured URL and missing-URL error | ✅ Mypy clean for Alembic/database URL files |
| 3.1 | `backend/tests/test_portfolio_use_cases.py` | Application/integration | ✅ 37 passed | ✅ Missing unit-of-work and repository delete methods; sale price not accepted | ✅ 4 passed | Purchase/sale history, oversell, delete-sale replay, delete-last-purchase | ✅ Sale price preserved; atomic UoW |
| 3.2a | `backend/tests/test_valuation_alerts.py` | Unit | ✅ 41 passed | ✅ Missing valuation/alert modules | ✅ 11 passed | Currency groups, unavailable quotes, both neutral crossings, directional messages, repeat suppression | ✅ Decimal-only rules |
| 3.2b | `backend/tests/test_market_analysis.py` | Unit | ✅ 41 passed | ✅ Missing analysis module | ✅ 3 passed | Full/short/empty history | ✅ Unknown on unavailable inputs |
| 3.2c | `backend/tests/test_analytics_use_cases.py` | Application | ✅ 41 passed | ✅ Missing analytics service; None quote raised TypeError | ✅ 5 passed | Provider quote/history, currency groups, unavailable quote, alert dispatch | ✅ Injected ports |
| 3.2d | `backend/tests/test_market_data_adapter.py` | Adapter | ✅ 41 passed | ✅ Missing yfinance adapter | ✅ 4 passed | Current-field fallback, history conversion, provider failure | ✅ Lazy import, no network |
| 3.2e | `backend/tests/test_target_alert_use_cases.py`, `backend/tests/test_alembic.py` | Application/integration | ✅ 41 passed | ✅ Missing alert persistence and schema columns | ✅ 5 passed | Portfolio/wishlist BUY/SELL, first observation, repeat suppression, nullable migration | ✅ Intent state persisted |
| 3.2f | `backend/tests/test_persistence.py` | Persistence | ✅ 41 passed | ✅ Missing list_positions | ✅ 1 passed | Stable ordering by ticker/broker/category | ✅ Domain values returned |
| 3.3 | `backend/tests/test_resource_use_cases.py` | Application/integration | ✅ 70 passed | ✅ Missing ResourceUseCases | ✅ 3 passed | Wishlist target CRUD, bibliography metadata CRUD, forward/reverse split | ✅ Return DTOs instead of detached ORM records |
| 2.4e | Live Compose stack | Integration | ✅ 37 tests passed | N/A (runtime gate) | ✅ PostgreSQL healthy; `a0001_initial (head)`; `/ready` returned 200 | Verified all four tables via SQLAlchemy query | ✅ Services remained healthy |

## Validation Evidence

- Safety net before phase-one edits: `pytest tests` -> 4 passed.
- Characterization slice: 5 passed; legacy split slice: 2 passed.
- Backend health slice: 2 passed.
- Portfolio and split domain slice: 9 passed.
- Full repository suite: `pytest -q` -> 22 passed.
- Full repository suite after persistence: `pytest -q` -> 28 passed.
- Persistence slice: 5 passed; backend project-manifest check: passed.
- Full repository suite after DB/Compose configuration: `pytest -q` -> 35 passed.
- Full repository suite after Alembic URL guard: `pytest -q` -> 37 passed.
- Alembic initial migration against clean temporary SQLite: passed; PostgreSQL offline SQL generation passed.
- Compose YAML parsed; PostgreSQL has no public port; backend depends on the database healthcheck and applies Alembic before Uvicorn.
- Host Docker Compose build/start passed through Flatpak host access; PostgreSQL/backend healthy; live revision `a0001_initial (head)`; tables verified; host `/ready` -> 200.
- Full repository suite after application use cases: `pytest -q` -> 41 passed.
- Full repository suite after analytics/market/alerts: `pytest -q` -> 70 passed.
- Full repository suite after wishlist/bibliography/split use cases: `pytest -q` -> 73 passed.
- Ruff passed; mypy passed for application and persistence adapters; `git diff --check` passed.
- Live PostgreSQL upgraded to `a0002_target_alerts (head)`; alert columns verified on portfolio and wishlist; `/ready` -> 200.
- Ruff passed; mypy passed on 24 domain/application/adapter/migration/test files; `git diff --check` passed.
- Ruff passed; targeted mypy on `backend/app/application`, persistence adapters, and use-case tests: no issues.
- Ruff: passed; targeted mypy on `backend/alembic/env.py` and `backend/app/adapters/persistence/database.py`: no issues; `git diff --check`: passed.
- The normal VS Code sandbox does not expose the Docker socket; verification used `/var/run/host/usr/bin/docker` through `flatpak-spawn --host`. `psycopg[binary]` is installed in the backend image.
- Ruff on changed implementation/tests: passed; `git diff --check`: passed.
- `finance.db` was not used or modified.
- Task 3.4: RED `pytest backend/tests/test_api.py -q` → 3 failed / 2 passed; GREEN `pytest backend/tests -q` → 87 passed; `PYENV_VERSION=3.12.10 python -m mypy backend/app/main.py` → no issues; `python -m ruff check backend` → passed; `pytest backend/tests/test_project_manifest.py -q` → passed. Commit `593b6c6`.
- Task 4.1: RED `pytest backend/tests/test_migration_dry_run.py -q` → ModuleNotFoundError; GREEN → 15 passed; `pytest backend/tests -q` → 102 passed; `mypy backend/app/adapters/migration` → no issues; `ruff check backend` → passed. `verify/verify_migration_dry_run.py` on a temp copy: portfolio 8 / transactions 9 / wishlist 0 / bibliography 0, ready=False with empty mapping (17 unresolved), ready=True with a full ticker→currency map; `finance.db` sha256 unchanged (`7897cb3c…33bc`).

## Known environmental failures (pre-existing, out of scope)

- `python -m ruff check verify` fails with 7 F401 in gitignored scratch scripts `verify/verify_avg_price.py` and `verify/verify_restructure.py`. These predate the change; a full-repo `ruff check backend verify` cannot pass without editing out-of-scope scratch files, so the task gate is `ruff check backend`.

## Files Changed

- `tests/test_domain_characterization.py`, `tests/test_calculations.py` — legacy transaction/analysis and split characterization.
- `src/services/calculations.py`, `main.py` — pure legacy split projection and UI delegation.
- `backend/pyproject.toml`, `backend/app/`, `backend/tests/` — backend manifest, health endpoint, immutable Decimal domain, split calculation and tests.
- `backend/app/adapters/persistence/` — SQLAlchemy records and caller-transaction-owned repositories; shared in-memory test fixture.
- `backend/app/application/{__init__.py,ports.py,portfolio.py}`, `backend/app/adapters/persistence/unit_of_work.py`, `backend/tests/test_portfolio_use_cases.py` — transactional portfolio operations, history, deletion/rebuild, and tests.
- `backend/app/application/resources.py`, `backend/tests/test_resource_use_cases.py` — wishlist, bibliography and split use cases.
- `backend/app/domain/{valuation.py,alerts.py,analysis.py}`, `backend/app/application/{analytics.py,alerts.py}`, `backend/app/adapters/market_data.py`, `backend/alembic/versions/a0002_target_alerts.py` — valuation/signals, provider adapter, and persistent target intents/state.
- `backend/alembic.ini`, `backend/alembic/`, `backend/app/adapters/persistence/database.py`, `compose.yaml`, `Dockerfile.backend`, `.env.example`, `.gitignore` — initial schema, engine/readiness, private PostgreSQL/backend stack and local-secret protection.
- OpenSpec design/specs/tasks updated for single-user, currencies, configurable alerts and progress.

## Remaining Tasks

Tasks 4.2-7.3 remain pending. Alert intents are neutral (cross either way), stop-loss/buy (downward), and sell (upward), with distinct messages and no repeated trigger. Legacy intents remain nullable until explicitly mapped during SQLite import.
