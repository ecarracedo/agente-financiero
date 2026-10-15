# Archive Report: financial-agent-modernization

**Change**: financial-agent-modernization
**Archived**: 2026-10-15
**Verdict before archive**: PASS WITH WARNINGS

## Result

The modernization change delivered phases 1 to 6.2 (19 of 23 tasks). Its verification was superseded on 2026-10-15 by a current pass that found no blockers: 179 backend tests passed, 91 frontend tests passed, the OpenAPI drift check passed and the scoped type check passed. The remaining 4 tasks (6.3, 7.1, 7.2 and 7.3), along with a set of deferred findings (R1, R4-002, R4-001, R2-1, R2-2) and the quality-gates interpreter issue, were moved to the new change `deployment-hardening-and-cutover` in the same action.

## Verification Evidence

- Git commit under verification: `0a656b0`
- Backend tests: `python -m pytest backend/tests -q` → 179 passed (Python 3.13.3)
- Frontend tests: `cd frontend && npm test -- --run` → 91 passed across 15 files
- API drift: `cd frontend && npm run check:api-drift` → generated types match `frontend/openapi.json`
- Type check: `PYENV_VERSION=3.12.10 python -m mypy backend/app/agents backend/app/application` → success, 11 source files, no issues
- Whitespace: `git diff --check` → clean
- Stack health (delivery evidence): `/`, `/health`, `/ready`, `/api/v1/portfolio` all return 200
- Native reviews (prior): 6.2 and the follow-up both independently reviewed and approved; no blockers
- Independent verifications (prior): the delivered slices carried independent verification with zero blockers

## Coverage Limitation

The current verification did not open test files or scenario text for four of the five capabilities. As recorded in the refreshed `verify-report.md`, requirement verdicts were partly inferred from passing suites mapped to tasks: 10 met, 5 partially met, 1 not verifiable and 0 not met. The partially met and not verifiable verdicts cluster on live-stack scenarios owned by the moved-out tasks and on non-exercised stack starts.

## Warnings Carried Forward

- `mypy` is installed only under the unrelated global interpreter 3.12.10, not in the pinned Python 3.13.3 interpreter. Also `mypy .` (the configured `build_command`) inspects the gitignored `verify/strands_src` tree and reports roughly 198 irrelevant errors. Tracked as task 1.3 of `deployment-hardening-and-cutover`.
- The Coolify single-user access-control question remains open. Tracked as task 1.1 of `deployment-hardening-and-cutover`.
- The proxy and nginx tests need hardening (R4-001, R2-1, R2-2) and the deployment config test needs adjustment (R2-2). All tracked in tasks 1.2 of `deployment-hardening-and-cutover`.
- The agent runtime must be bounded (R4-002). Tracked as task 3.1 of `deployment-hardening-and-cutover`.
- The reported "Legacy runtime removal" and "Coolify deployment" remain only partially/not verifiable for the archived scope, but they are the explicit responsibility of the moved-out tasks (6.3, 7.3) and their gate work in `deployment-hardening-and-cutover`.

## Pending Work Moved

The following work was moved to `openspec/changes/deployment-hardening-and-cutover/` by user decision:

- Task 6.3: Validate the Coolify deployment and Playwright E2E flows against Compose (including restart and dependency failure)
- Task 7.1: Update README.md and dependency manifests; document setup, variables, migration, rollback and operation
- Task 7.2: Run the parity gate, backup, write freeze, reconciliation and restore before the cutover
- Task 7.3: Retire `main.py`, `src/ui/`, Peewee and the SQLite runtime after the gate is approved

The following findings were moved with them:

- R1 — API published without access control (`compose.yaml:55-56`)
- R4-002 — unbounded agent runtime (`backend/app/agents/service.py:98-108`)
- R4-001 — proxy hardening (`frontend/nginx.conf:10-30`)
- R2-1 — proxy resolver (`frontend/nginx.conf:10-17`)
- R2-2 — reload-flag assertion (`backend/tests/test_deployment_config.py:219-224`)
- The quality-gates interpreter/mypy configuration issue

## Archived Artifacts

The following files from the change were archived with this folder:

- `proposal.md`
- `exploration.md`
- `design.md`
- `apply-spec.md`
- `apply-progress.md`
- `tasks.md`
- `verify-report.md` (replaced with a current verification on 2026-10-15 and is preserved here in that form)
- `specs/containerized-deployment/spec.md` (full spec for the delivered state)
- `specs/financial-domain-api/spec.md` (full spec)
- `specs/financial-web-frontend/spec.md` (full spec)
- `specs/postgres-data-migration/spec.md` (full spec)
- `specs/read-only-financial-agent/spec.md` (full spec)

All five capability specs were synced to `openspec/specs/` as the new source of truth.

## Source of Truth

The canonical capability specifications now live under `openspec/specs/`. The remaining work continues under `openspec/changes/deployment-hardening-and-cutover/` with its own proposal, design, tasks and deltas against the new source of truth.
