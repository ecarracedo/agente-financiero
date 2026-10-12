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
- [x] 4.2 Implemented the transactional, idempotent import (`importer.py`, `runner.py`, `__main__.py`) keyed on a per-entity nullable unique `source_id`, with `Compra`/`Venta`→`BUY`/`SELL`, mandatory currency, and a single-session commit only when `ValidationReport.ready`; added `ImportResult`/`ReconciliationReport` and Alembic `a0003_migration_source_ids`. CLI: `python -m backend.app.adapters.migration` (`dry-run`|`import`|`reconcile`).
- [x] 4.3 Built the migration rehearsal harness (`verify/verify_migration_rehearsal.py`, gitignored scratch) running dry-run → import → reconcile against an immutable copy of `finance.db` with a temp SQLite destination (schema via `alembic upgrade head`): counts 8/9/0/0, `operation_type` all `BUY`, `alert_intent` NULL, idempotent re-import (17 skipped), and a perturb-then-restore demo. Procedure documented in `docs/operations/migration.md` and the README (EN/ES); user-confirmed mapping all `.BA`→`ARS`.
- [x] 5.1 Scaffolded `frontend/` (Vite 8, React 19, TypeScript 5.9, Vitest 5, React Testing Library) with a versioned `frontend/openapi.json` and generated `src/api/types.ts` (openapi-typescript). Typed `http.ts` (`VITE_API_BASE_URL`, `ApiError` with 422/503, money kept as strings) and `client.ts` over generated paths; minimal `App` shell. 10 tests.
- [x] 5.2 Built the portfolio workspace (summary, holdings table, per-currency valuations/P&L) and transactions workspace (buy/sell form + position-scoped history with delete), plus shared `DataTable`/`CurrencyAmount`/`AsyncStates`/`FormControls`; extended `client.ts` with typed wrappers. Money stays strings; `market_value`/`gain_loss` null → "Not available" (not 0); totals grouped by currency (never summed); 422 shown as an error; refresh after mutation. 20 frontend tests.
- [x] 5.3 Built the market workspace (`frontend/src/features/market/`): ticker catalog (portfolio + wishlist) or free-text search, period selector (6 periods), line/area chart mode, price chart with a target-line overlay (wishlist `target_price` or the last configured alert target) and transaction markers from the position-scoped history, explicit "Not available" for `status: "UNKNOWN"` (never 0), and derived opportunities from analysis `signals`. Built the alerts feature (`frontend/src/features/alerts/`): intent selector (`NEUTRAL`/`STOP_LOSS`/`BUY`/`SELL`) + target price saved via the portfolio or wishlist alert endpoint, and the check result showing the backend `event.message` verbatim, "No crossing" when `event` is null, and "Not available" on a 503 (never 0). Added a `Market` tab to `App.tsx`. Series/overlay computation isolated in pure helpers (`series.ts`). 53 frontend tests.
- [x] 5.4 Built the wishlist workspace (`frontend/src/features/wishlist/`): list, add (`{ticker}`, 409 duplicate surfaced as an error), target CRUD via `PUT /target` (`{target_price: string|null}`, null clears; 404 surfaced) and delete (404 surfaced); target price stays a canonical string. Built the bibliography workspace (`frontend/src/features/bibliography/`): list and create form (title/author required; optional `year`/`link`/`description` omitted when blank, blank category defaulted to `"General"`; extra-property 422 surfaced) plus delete (404 surfaced). Built the split calculator (`frontend/src/features/tools/split/`): direction selector (Forward/Reverse) + integer ratio, forwarding `{quantity, average_price, new_shares, old_shares}` to `POST /api/v1/splits` and rendering the backend's canonical `quantity`/`average_price`/`ratio` strings verbatim — no client-side split math; invalid ratio → 422 shown as `describeApiError` (never a result). Added a reusable `TextAreaField` to `components/FormControls.tsx` and `Wishlist`/`Bibliography`/`Tools` tabs to `App.tsx`. 72 frontend tests.

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
| 5.3a | `frontend/src/features/market/series.test.ts` | Unit (pure helpers) | ✅ 20 passed | ✅ ImportError before `series.ts` | ✅ 5 passed | Flat domain padded; target beyond range folded into domain; unset target → null | ✅ Overlay geometry isolated from components |
| 5.3b | `frontend/src/features/market/MarketChart.test.tsx` | Component | ✅ 20 passed | ✅ Module missing | ✅ 5 passed | Line vs area; target present vs absent; marker symbol count + canonical marker text | ✅ Chart consumes pure `series.ts` helpers |
| 5.3c | `frontend/src/features/market/MarketWorkspace.test.tsx`, `OpportunityList.test.tsx` | Component/integration | ✅ 20 passed | ✅ Modules missing | ✅ 8 passed | Unknown analysis → unavailable (not 0); period refetch; free-text ticker; unknown signal preserved | ✅ Hooks derive status without synchronous effect state |
| 5.3d | `frontend/src/features/alerts/*.test.tsx` | Component/integration | ✅ 20 passed | ✅ Modules missing | ✅ 16 passed | Backend message verbatim; `event: null` → no crossing; 503 → unavailable (not 0); wishlist scope; single-currency label, no combined total | ✅ API boundary isolated in `alertApi.ts` |
| 5.3e | `frontend/src/App.test.tsx` | Shell | ✅ 4 passed | ✅ Market tab absent | ✅ 5 passed | Market tab opens chart controls | ➖ Tab wiring only |
| 5.4a | `frontend/src/features/wishlist/WishlistWorkspace.test.tsx` | Component/integration | ✅ 53 passed | ✅ Modules missing | ✅ 8 passed | Add ticker; duplicate 409; set/clear target; delete 404; canonical target string | ✅ API boundary isolated in `wishlistApi.ts` |
| 5.4b | `frontend/src/features/bibliography/BibliographyWorkspace.test.tsx` | Component/integration | ✅ 53 passed | ✅ Modules missing | ✅ 5 passed | Required-only body omits optionals; full body; category default `General`; delete refetch; delete 404 | ✅ Omission logic isolated in `toRequestBody` |
| 5.4c | `frontend/src/features/tools/split/SplitWorkspace.test.tsx` | Component/integration | ✅ 53 passed | ✅ Modules missing | ✅ 3 passed | Forward 2:1; reverse 1:2; invalid ratio → 422 error, never a result (no client math) | ✅ Request encoding isolated in `splitApi.ts` |
| 5.4d | `frontend/src/App.test.tsx` | Shell | ✅ 53 passed | ✅ Tabs absent | ✅ 8 passed | Wishlist/Bibliography/Tools tabs open their workspaces | ➖ Tab wiring only |

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
- Task 4.2: RED `pytest backend/tests/test_migration_import.py -q` → ImportError; GREEN → 12 passed; `pytest backend/tests -q` → 114 passed; `mypy backend/app/adapters/migration backend/app/adapters/persistence/models.py` → no issues; `ruff check backend` → passed; `alembic upgrade head` → `a0003` head and `downgrade -1` → `a0002` proven on a temp SQLite URL; CLI dry-run/import/reconcile smoke OK; `finance.db` sha256 unchanged.
- Task 4.3: `python verify/verify_migration_rehearsal.py --source finance.db --currency-map <ars.json>` → exit 0, counts 8/9/0/0, `matched: True`, restore demo OK; `finance.db` sha256 unchanged (`7897cb3c…33bc`); `pytest backend/tests -q` → 114 passed; `ruff check backend` → passed.
- Task 5.1: RED `npm test` → unresolved imports; GREEN `npm test` → 10 passed; `npm run build` → success; `npm run lint` → clean; `pytest backend/tests -q` → 114 passed.
- Task 5.2: RED `npm test` → 2 feature suites failed to resolve imports; GREEN `npm test` → 20 passed (4 suites); `npm run build` → success; `npm run lint` → clean; `pytest backend/tests -q` → 114 passed. Contract notes: `GET /api/v1/valuations` returns a currency-keyed OBJECT (`dict[str, CurrencyValuationResponse]`), not an array; `GET /api/v1/transactions` requires `ticker`+`broker` query params (history is position-scoped).
- Task 5.3: chart library = **recharts 3.10.1** (React 19 compatible). RED `npx vitest run src/features/market src/features/alerts` → 7 suites failed (modules missing); GREEN `npx vitest run ...` → 8 suites / 37 passed; full `npm test` → 53 passed (11 suites); `npm run build` → success; `npm run lint` → clean; `pytest backend/tests -q` → 123 passed (no backend touched). No feature test performs network I/O: all rendering suites mock `marketApi`/`alertApi` (and `api` in `App.test.tsx`); the only `fetch` exercise is the pre-existing `http.test.ts`, which stubs global `fetch`.
  - **Chart library decision**: recharts was attempted first per the task; it installs (`npm install recharts@^3.10.1`), type-checks, and builds cleanly against React 19, and renders real SVG under jsdom. The chart uses an explicit `width`/`height` (`ComposedChart`) instead of `ResponsiveContainer`, avoiding jsdom's missing `ResizeObserver`/zero-dimension problems; a spike confirmed `.recharts-line-curve`, `.recharts-area-area`, `.recharts-reference-line`, and `.recharts-scatter-symbol` are all assertable. No dependency-free SVG fallback was needed. Known cost: bundle grows to 582.13 kB (173.79 kB gzip), triggering Vite's >500 kB chunk-size warning (non-fatal). Accepted for this task; code-splitting the chart is a follow-up.
  - **Opportunities interpretation** (documented per task): the backend `MarketAnalysisResponse.signals` (`NEAR_52_WEEK_LOW`, `NEAR_52_WEEK_HIGH`, `BELOW_200_DAY_AVERAGE`, `ABOVE_200_DAY_AVERAGE`) are rendered as a labeled list inside the market view; unknown codes stay visible with their raw value. Pure frontend derivation — no backend change.
  - **Target overlay source**: portfolio holdings do not expose `target_price` (`PortfolioPositionResponse` has none), so the target line uses the wishlist item's `target_price` when present, otherwise the target the user just saved in the alert panel for that ticker (kept in local state). No extra GET was added.
  - **Overlay alignment**: transaction markers are placed on a numeric timestamp x-axis so they align with the series by date; the marker list displays the canonical `unit_price` string plus its currency (never a parsed number).
- Task 5.4: RED `npx vitest run src/features/wishlist src/features/bibliography src/features/tools` → 3 suites failed (modules missing); GREEN → 3 suites / 16 passed; full `npm test` → 72 passed (14 suites); `npm run build` → success; `npm run lint` → clean; `python -m pytest backend/tests -q` → 123 passed (no backend touched). No feature test performs network I/O: all rendering suites mock `wishlistApi`/`bibliographyApi`/`splitApi` (and `api`/`marketApi`/`alertApi` in `App.test.tsx`).
  - **Split staying backend-driven**: the calculator sends raw inputs and renders the returned canonical strings; there is no client-side projection math, so the backend remains the single source of split truth (per the spec scenario).
  - **Build-caught path bug**: `splitApi.ts` initially imported `../../api/http` (one level too shallow). Vitest passed because `vi.mock('./splitApi', factory)` bypasses loading the real module, so unresolved specifiers in a mocked module slip past the test run; `tsc -b` in `npm run build` caught it. Fixed to `../../../api/http`.
  - **Vitest mock-reset interaction**: `vi.resetAllMocks()` in `afterEach` breaks the mount+refresh sequence in suites where the refetch re-reads the list mock; `vi.clearAllMocks()` keeps per-test implementations intact. Wishlist/Split/App use their working form; bibliography uses `clearAllMocks` with each test seeding its own mocks.

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
- `frontend/src/features/market/` — `marketApi.ts`, `series.ts`, `useMarketAnalysis.ts`, `useMarketCatalog.ts`, `useTransactionMarkers.ts`, `MarketChart.tsx`, `OpportunityList.tsx`, `MarketWorkspace.tsx` + tests; recharts-based chart with target-line and transaction-marker overlays.
- `frontend/src/features/alerts/` — `alertApi.ts`, `AlertConfigForm.tsx`, `AlertStatus.tsx`, `AlertsPanel.tsx` + tests; intent configuration and backend-driven crossing messages.
- `frontend/src/App.tsx`, `frontend/src/App.test.tsx` — `Market` tab hosting the market + alerts workspace; later extended with `Wishlist`, `Bibliography`, and `Tools` tabs.
- `frontend/package.json`, `frontend/package-lock.json` — added `recharts@^3.10.1`.
- `frontend/src/features/wishlist/` — `wishlistApi.ts`, `useWishlist.ts`, `WishlistTable.tsx`, `WishlistWorkspace.tsx` + test; list/add/set-target/delete CRUD.
- `frontend/src/features/bibliography/` — `bibliographyApi.ts`, `useBibliography.ts`, `BibliographyForm.tsx`, `BibliographyTable.tsx`, `BibliographyWorkspace.tsx` + test; list/create/delete with optional-field omission.
- `frontend/src/features/tools/split/` — `splitApi.ts`, `SplitWorkspace.tsx` + test; backend-delegated forward/reverse split projection.
- `frontend/src/components/FormControls.tsx` — added reusable `TextAreaField` (+ `TextAreaFieldProps`) for the bibliography description.

## Remaining Tasks

Tasks 5.5-7.3 remain pending. Phase 4 (delivery slice P2) is complete; Phase 5 (P3) is being delivered sub-sliced: 5.1 scaffold, 5.2 portfolio, 5.3 market/alerts, 5.4 resources.

## Delivery

- P1 (task 3.4) → commit `593b6c6`. P2 (Phase 4: 4.1-4.3 + `a0003`) → commits `7c3ff96`, `c6319ee`, and this one. P2 authored ~1,470 lines (>400 heuristic) across the phase; per `apply-spec.md` §slicing it needs `size:exception` or a cohesive split at PR time (recorded, not yet sliced). Alert intents are neutral (cross either way), stop-loss/buy (downward), and sell (upward), with distinct messages and no repeated trigger. Legacy intents remain nullable until explicitly mapped during SQLite import.
