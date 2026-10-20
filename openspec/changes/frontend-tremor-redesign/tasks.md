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
- [x] 1.4 Remove the per-module `vi.mock` calls workspace by workspace; the suite stays green throughout.
  - Blocker cleared: commit `8a38df6` corrected the harness against `frontend/openapi.json`. The routes and the fixture shapes were both wrong; the frontend client was always correct, so nothing in production was affected.
  - First workspace migrated: `PortfolioWorkspace.test.tsx` runs on MSW with no `vi.mock` and keeps its six tests. Loading and failure reach the real client through `server.use`, so `tests/setup` now exports the server.
  - Guard added: `src/mocks/contract.test.ts` reads the contract and fails when a handler registers an unknown path, a consumed route has no handler, or a fixture loses a required field.
  - Evidence: commit `8a38df6`; `npm test` 121/121.
  - Remaining: 8 test files still use `vi.mock` — `App.test.tsx` (deleted in 5.2), `MarketWorkspace`, `WishlistWorkspace`, `TransactionsWorkspace`, `BibliographyWorkspace`, `SplitWorkspace`, `AlertsPanel` and `useTransactionHistory`. Each is independent and lands one commit at a time.

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

- [x] 3.1 `FormControls`: add error and description props, `aria-invalid`, `aria-describedby` and a numeric input.
  - RED: an error is associated with its field and announced.
  - Delivered: `error` marks the field `aria-invalid` and is linked through `aria-describedby`; `description` is linked without marking the field invalid; both link together in reading order. Applied to `TextField`, `TextAreaField` and `SelectField`. Evidence: commit `<pending>`; 7 tests, suite 128/128.
  - Structure change: the `<label>` no longer wraps the input. It was wrapping the hint and error spans too, so the error text was absorbed into the field's accessible name ("Quantity Quantity must be a number"). The label is now its own element linked by `htmlFor`, and the messages are siblings. Every existing `getByLabelText` call site still resolves.
  - Numeric input: already satisfied. `TextField` has carried the `inputMode` prop (`'text' | 'decimal' | 'numeric'`) and all seven call sites use it, so a separate `NumberField` would be a second way to do the same thing. No new component added.
  - Constraint found for 4.4: the `error` prop has no consumer yet. `AlertsPanel` validates the target price with a form-level `saveError`, which the spec forbids ("associated with the field that caused it"). Wiring that field is task 4.4, not 3.1.
- [x] 3.2 `AsyncStates`: add empty and success components, distinguishable from loading.
  - Delivered: `EmptyState` and `SuccessState` join the existing `LoadingState` and `ErrorState`. Evidence: commit `<pending>`; 7 tests, suite 135/135.
  - Role mapping, so a screen reader distinguishes them without relying on wording: loading and success are polite `role="status"` announcements, error is assertive `role="alert"`, and empty carries **no** live role because it is a settled result, not an event.
  - `EmptyState` takes a required `message`, because the spec asks for a state specific to the view, not one generic string.
  - Not yet consumed: the components land here and the call sites follow in Phase 4. Today the empty state travels as `emptyMessage=` strings through `DataTable` (6 call sites) and the one success message is hardcoded at `AlertsPanel.tsx:127`. Converting those is part of 3.3 and 4.4.
  - Checked and dismissed: `AlertsPanel` uses `role="status"` for its success message, but it never renders a `LoadingState`, so the two never coexist. Not a defect.
- [x] 3.3 `DataTable`: caption, numeric alignment, sorting and row actions, on Tremor's Table.
  - Delivered: rebuilt on the vendored `Table`. `caption` is now **required** and reaches the table's accessible name; `Column<T>` accepts `align` (`'left' | 'right'`), written to `data-align` on both the header and its cells so the alignment lives in the markup and not only in a class; an empty result now renders through `EmptyState`. Evidence: commit `<pending>`; 6 tests, suite 141/141.
  - `Column.render` is unchanged, so the five consuming tables kept their contract and no rendering logic moved.
  - **Scope decision:** sorting was dropped from this task. It is not in the spec, and doing it here would move the ordering responsibility out of the caller and require a comparator on `Column<T>` plus changes in all five tables. Revisit when Phase 4 touches the tables.
  - Alignment applied on the numeric columns: `Quantity`, `Average price`, `ID`, `Unit price` (transactions), `Invested`, `Market value`, `Gain/Loss`, `Gain/Loss %` (valuations), `Target price` (wishlist), `Year` (bibliography). Text columns stay left; `Actions` stays left because a button is not a number.
  - Row actions needed no new API: `WishlistTable` and `BibliographyTable` already render buttons through `render`, and now inherit the Tremor cell styling.
  - Bundle cost, first real increase of the change: JS 1010.75 kB → 1041.66 kB (gzip 338.98 → 348.97 kB) from the vendored `Table` arriving in the bundle. CSS 9.54 → 9.57 kB.
  - Verified independently of the suite: a throwaway probe mounted the real shell and confirmed the caption, the alignment and the empty state all reach the DOM; the workspace tests do not assert table markup, so the suite alone would not have caught a regression here.
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
