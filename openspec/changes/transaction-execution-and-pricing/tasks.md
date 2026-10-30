# Tasks: Transaction Execution and Price Autofill

## Phase 1: TransactionForm Autofill & Defaults

- [x] 1.1 Add smart defaults in `TransactionForm` (`occurred_at`, `currency`, `broker`, `category`).
- [x] 1.2 Implement quote autofill in `TransactionForm` on ticker blur via `marketApi.getAnalysis` (plus an explicit "Cotización" button).
- [x] 1.3 Add tests in `TransactionsWorkspace.test.tsx` verifying price autofill and defaults without breaking existing tests.

## Phase 2: QuickOrderCard Real Execution & Quotes

- [x] 2.1 Connect ticker selection in `QuickOrderCard` to `marketApi.getAnalysis` for live pricing.
- [x] 2.2 Implement real `api.createTransaction` submission in `QuickOrderCard` with error/success feedback.
- [x] 2.3 Wire `onTransactionCreated` callback in `PortfolioWorkspace` to re-fetch portfolio data immediately.

## Phase 3: Verification & Docker Validation

- [x] 3.1 Verify complete frontend test suite (`npm test`), `tsc -b`, and ESLint.
- [ ] 3.2 Verify interactive execution in demo mode and build production bundle (`npm run build`).

## Notes

- `frontend/src/lib/datetime.ts` centralizes the local `datetime-local` value used for `occurred_at` by both entry points.
- `QuickOrderCard` derives its loading state (`symbol !== quotedTicker`) instead of writing state inside the quote effect, which keeps `react-hooks/set-state-in-effect` satisfied.
- Production bundle builds and the OpenAPI drift check passes; interactive demo-mode verification remains pending.
