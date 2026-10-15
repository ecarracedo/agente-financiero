# Tasks: frontend Tremor redesign

Every task is completable in one session and leaves the application runnable. Tests are Vitest (`npm test`).

## Phase 1: Harness first (no visual change)

- [ ] 1.1 Add `msw`; create `src/mocks/fixtures.ts` and `src/mocks/handlers.ts` covering every `/api/v1` route.
  - RED: a test that renders a workspace with no module mock and fails for lack of data.
- [ ] 1.2 Extend `tests/setup.ts` with the `setupServer` lifecycle (`listen`, `resetHandlers`, `close`).
- [ ] 1.3 Add `tests/render.tsx` using `createMemoryRouter`; migrate one workspace test off `vi.mock` as proof.
- [ ] 1.4 Remove the per-module `vi.mock` calls workspace by workspace; the suite stays green throughout.

## Phase 2: Toolchain and routing

- [ ] 2.1 Add `tailwindcss` and `@tailwindcss/vite`; create `src/index.css` with `@import "tailwindcss"` and import it from `main.tsx`.
  - RED: a test asserting a rendered element carries its Tailwind class.
- [ ] 2.2 Vendor one Tremor Raw component and verify compatibility (peer React `^18.3` against 19.3) before going further.
- [ ] 2.3 Vendor the remaining non-chart Tremor components in use into `src/components/tremor/`.
- [ ] 2.4 Add `react-router`; create the route tree and the mount-once shell; promote alerts to its own route.
  - RED: a deep-link test (open a workspace URL directly) and an entered-data-survives-navigation test.

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
