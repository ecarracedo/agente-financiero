# Tasks: frontend Tremor redesign

Every task is completable in one session and leaves the application runnable. Tests are Vitest (`npm test`).

## Phase 1: Harness first (no visual change)

- [x] 1.1 Add `msw`; create `src/mocks/fixtures.ts` and `src/mocks/handlers.ts` covering every `/api/v1` route.
  - RED: a test that renders a workspace with no module mock and fails for lack of data.
  - Evidence: commit `6f310a4`. Handlers cover health, ready, portfolio, valuations, transactions, market, alerts, wishlist, bibliography and split.
- [x] 1.2 Extend `tests/setup.ts` with the `setupServer` lifecycle (`listen`, `resetHandlers`, `close`).
  - Evidence: commit `6f310a4`, corrected in `2d3f017` (MSW 3 renamed the option to `onUnhandledFrame`).
- [x] 1.3 Add `tests/render.tsx` using `createMemoryRouter`; migrate one workspace test off `vi.mock` as proof.
  - Evidence: commit `6f310a4`. Helper exists; **the workspace migration off `vi.mock` is still pending** (task 1.4).
- [ ] 1.4 Remove the per-module `vi.mock` calls workspace by workspace; the suite stays green throughout.
  - **BLOCKER (found 2026-10-19).** `src/mocks/handlers.ts` registers invented routes, so with `onUnhandledFrame: 'error'` every migrated test would fail. Verified against `frontend/openapi.json`. Fix the handlers before starting this task.
    - Invented, real route on the right: `/api/v1/market/analysis/:ticker` → `/api/v1/analysis/{ticker}`; `/api/v1/market/portfolio` → `/api/v1/portfolio`; `/api/v1/market/transactions` → `/api/v1/transactions`; `/api/v1/market/wishlist` → `/api/v1/wishlist`; `/api/v1/alerts/portfolio` → `/api/v1/portfolio/{ticker}/alert`; `/api/v1/alerts/wishlist` → `/api/v1/wishlist/{ticker}/alert`; `/api/v1/tools/split` → `/api/v1/splits`; `/api/v1/health` → `/health`; `/api/v1/ready` → `/ready`.
    - Real routes with no handler: `/api/v1/splits`, `/api/v1/portfolio/{ticker}/alert`, `/api/v1/portfolio/{ticker}/alert/check`, `/api/v1/wishlist/{ticker}/alert`, `/api/v1/wishlist/{ticker}/alert/check`, `/api/v1/analysis/{ticker}`, `/health`, `/ready`.
    - Path parameter names differ too: `{item_id}` and `{transaction_id}`, not `:id`.
    - The whole harness (tasks 1.4 and 5.1) depends on this being correct.

## Phase 2: Toolchain and routing

- [x] 2.1 Add `tailwindcss` and `@tailwindcss/vite`; create `src/index.css` with `@import "tailwindcss"` and import it from `main.tsx`.
  - RED: a test asserting a rendered element carries its Tailwind class.
  - Evidence: commits `6f310a4` + `2d3f017`. Build emits a 7.09 kB CSS asset; `tests/tailwind-toolchain.test.ts` compiles the real utilities.
- [x] 2.2 Vendor one Tremor Raw component and verify compatibility (peer React `^18.3` against 19.3) before going further.
  - Evidence: commit `2d3f017`. `Card` renders, merges `className` and forwards a ref under React 19.3. Risk closed.
- [x] 2.3 Vendor the Tremor class merge core and the components the workspaces actually consume, into `src/components/tremor/`.
  - RED: a class conflict must resolve to the caller's utility, not to whichever CSS rule comes later.
  - Evidence: commit `c1154de`. `cx` replaced with the Tremor Raw contract `twMerge(clsx(...))`; `clsx` and `tailwind-merge` declared as direct dependencies (`clsx` was only reachable transitively through `recharts`). Vendored `Table`, which depends only on `cx`.
  - **Scope redefined (2026-10-19).** The task said "the remaining non-chart Tremor components"; vendoring them in bulk contradicts D1's own trade-off, "copy only what is used, no speculative imports". Inspected upstream: only `Table` needs `cx` alone. `Button`, `Badge`, `ProgressBar` and `Callout` need `tailwind-variants`; `Dialog`, `Tabs` and `Select` need Radix packages; the button spinner needs `@remixicon/react`. Six runtime dependencies, none installed. Each is copied when a Phase 4 workspace consumes it, and the dependency lands with it.
  - Deviation from upstream: `TableHeaderCell` defaults `scope` to `col`. Upstream leaves it unset; every table here is a data table, so the explicit scope is stated once in the primitive instead of at five call sites.
- [x] 2.4 Add `react-router`; create the route tree and the mount-once shell; promote alerts to its own route.
  - RED: a deep-link test (open a workspace URL directly) and an entered-data-survives-navigation test.
  - Evidence: commit `bc56109`. Four route tests. Design D4 deviation: every workspace is mounted up front and hidden when inactive, because the "mount on first visit" bookkeeping forced ref-mutation during render, which React rejects. Accepted trade-off: all seven workspaces fetch at startup.
  - Debt found: `App.tsx` is now unused in production but its 12 tests still pass, so the suite does not flag it. Delete it in 5.2.
  - Drift found: `marketApi.getAnalysis` calls `/api/v1/analysis/:ticker` while `src/mocks/handlers.ts` registers `/api/v1/market/analysis/:ticker`. Confirm the real route before the harness replaces `vi.mock` in 1.4.

## Phase 3: Shared components

- [ ] 3.1 `FormControls`: add error and description props, `aria-invalid`, `aria-describedby` and a numeric input.
  - RED: an error is associated with its field and announced.
- [ ] 3.2 `AsyncStates`: add empty and success components, distinguishable from loading.
- [ ] 3.3 `DataTable`: caption, numeric alignment, sorting and row actions, on Tremor's Table.
- [ ] 3.4 `CurrencyAmount`: currency plus a sign and a non-colour gain/loss cue.
  - RED: a gain and a loss are distinguishable without colour.

## Phase 4: Workspaces (one commit each)

- [ ] 4.1 Portfolio
- [ ] 4.2 Transactions — per-field errors, delete confirmation, no silent filter failure, scoped success
- [ ] 4.3 Market — restyled chrome; target line and transaction markers preserved
- [ ] 4.4 Alerts — own route, target-price validation on the shared field component
- [ ] 4.5 Wishlist — remove confirmation
- [ ] 4.6 Bibliography — delete confirmation
- [ ] 4.7 Tools / split

## Phase 5: Demo mode and cleanup

- [ ] 5.1 `src/dev/demo.ts` starting the browser worker behind a flag; document it in `README.md`.
- [ ] 5.2 Delete `App.tsx` and any dead tab code.
- [ ] 5.3 Full checks: `npm test`, `npm run lint`, `npm run build`, `npm run check:api-drift`.

## Phase 6: Verification

- [ ] 6.1 Run with the demo flag on and walk every workspace with no backend running.
- [ ] 6.2 Confirm the production image still serves a deep link (nginx `try_files` unchanged, no deployment diff).
