# Design: frontend Tremor redesign

## Context

The frontend renders unstyled raw HTML (see `exploration.md` §4): no CSS file, no Tailwind and not a single `className` in `frontend/src`. Every `/api/v1` route is already consumed, so this is a presentation and testability change, not a feature change. There are 91 tests across 15 files that must keep passing while the UI is replaced underneath them.

## Decisions

### D1. Tremor Raw copied into the repository, on Tailwind CSS 4

**Decision.** Vendor the Tremor Raw components we need into `frontend/src/components/tremor/` and style with Tailwind CSS 4 through its first-party Vite plugin (`@tailwindcss/vite`, `@import "tailwindcss"`, zero configuration, automatic content detection).

**Rejected.** The `@tremor/react` npm package, which bundles its own Recharts, Headless UI and a Tailwind-3-era setup. Two chart majors would land in the bundle, and `MarketChart` already carries domain overlays that Tremor's chart wrappers do not express.

**Trade-off accepted.** Vendored components become our code to maintain. Mitigation: copy only what is used, no speculative imports.

### D2. Charts stay on Recharts 3.10

`MarketChart` renders a target line and transaction markers. Only its surrounding chrome (card, heading, legend, loading, empty) moves to Tremor. Consequence: Tremor's chart components are not copied at all; only non-chart components (Card, Table, Badge, Button, Tabs, Dialog, Select, Metric, Callout, ProgressBar and similar) are.

### D3. Routing with `react-router` v7

**Decision.** `npm i react-router`; `createBrowserRouter` from `react-router`, `RouterProvider` from `react-router/dom`.

**Why it is cheap here.** The server side is already ready: `frontend/nginx.conf:46-48` has `try_files $uri $uri/ /index.html`, so deep links need **no deployment change**, and the Vite dev server already falls back to the SPA for unknown paths. This was the main risk and it does not exist.

**Constraint.** SPA route names MUST NOT collide with `location ~ ^/(api/|health$|ready$)` (`frontend/nginx.conf:29`): `/api/**`, `/health` and `/ready` are proxied to the backend.

### D4. Mount-once-then-hide for state preservation

Each workspace mounts on first visit and then stays mounted, hidden via the `hidden` attribute when inactive. Satisfies the preserved-state requirement with no global store, and avoids firing all seven fetch-on-mount sequences at startup. `hidden` also removes the inactive workspace from the accessibility tree.

### D5. MSW used twice: `setupWorker` in dev, `setupServer` in tests

One set of handlers (`http.get(...) → HttpResponse.json(...)`) powers both. In dev a flag starts the browser worker so a reviewer can walk every workspace without a backend; in tests the node server intercepts `fetch`. Demo data therefore cannot rot away from test data. This replaces the per-module `vi.mock` strategy.

### D6. Tests render through `createMemoryRouter`

The shared helper wraps a workspace in the same route tree the application uses, with `createMemoryRouter` and `initialEntries`. Tests then exercise real navigation and real route wiring instead of a hand-mocked shell.

## Data flow

```
dev    browser ──▶ MSW worker ──▶ shared handlers ──▶ shared fixtures
                   (no backend needed)

test   vitest ──▶ MSW node server ──▶ shared handlers ──▶ shared fixtures

prod   browser ──▶ nginx ──┬──▶ /api | /health | /ready ──▶ backend
                           └──▶ anything else ──▶ index.html ──▶ react-router
```

## File changes

| File | Change |
|---|---|
| `frontend/package.json` | Add `tailwindcss`, `@tailwindcss/vite`, `react-router`, `msw`; add the Tremor peer deps actually used |
| `frontend/vite.config.ts` | Register the Tailwind plugin; add the Vitest config for the demo flag |
| `frontend/src/index.css` | New — `@import "tailwindcss"`, imported from `main.tsx` |
| `frontend/src/components/tremor/**` | New — vendored Tremor Raw components in use |
| `frontend/src/app/routes.tsx`, `frontend/src/app/WorkspaceShell.tsx` | New — route tree and mount-once shell |
| `frontend/src/main.tsx` | Wire `createBrowserRouter` + `RouterProvider` |
| `frontend/src/App.tsx` | Superseded by the shell; deleted at the end of the migration |
| `frontend/src/components/{DataTable,FormControls,AsyncStates,CurrencyAmount}.tsx` | Rebuilt on Tremor, with error/description props, `aria-invalid` and `aria-describedby` |
| `frontend/src/features/**` | Each workspace restyled; alerts promoted to its own route |
| `frontend/src/mocks/handlers.ts`, `frontend/src/mocks/fixtures.ts` | New — shared handlers and fixtures |
| `frontend/src/dev/demo.ts` | New — starts the browser worker behind a flag |
| `frontend/tests/setup.ts`, `frontend/tests/render.tsx` | Extended — MSW lifecycle and the shared render helper |

## Testing strategy

`strict_tdd: true` applies. Per workspace: RED (a test failing against the current behavior or the new state requirement), GREEN, then keep the existing suite green. The harness lands **first**, so every later slice is cut against MSW and the shared helper rather than module mocks.

Note: `openspec/config.yaml` declares `test_command: pytest` and a Streamlit/SQLite context. Both are stale for the frontend; frontend tasks use `npm test` (Vitest).

## Migration

Incremental, one workspace per commit: harness → toolchain and routing → shared components → workspaces one at a time → delete `App.tsx` and the last module mocks. The application stays runnable at every step, so a rollback never has to unwind more than one commit.

## Open questions

- Tremor Raw declares peer React `^18.3` while the project is on 19.3. Verify on the first vendored component before restyling everything; its primitives are Radix, which does support React 19.
- Demo flag as `VITE_DEMO=1` (preferred) versus a query parameter; confirm during implementation.
- `openspec/config.yaml` context and `test_command` still describe the pre-modernization stack and should be updated separately.
