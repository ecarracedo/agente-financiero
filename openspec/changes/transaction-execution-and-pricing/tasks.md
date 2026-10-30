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

## Phase 4: Asset Search

- [x] 4.1 Backend: `TickerMatch` domain shape, `search_symbols` port and use case, yfinance `Search` adapter, `GET /api/v1/tickers/search`, tests.
- [x] 4.2 Regenerate `frontend/openapi.json` and `src/api/types.ts`; keep the drift check green.
- [x] 4.3 Frontend: `TickerSearch` combobox component with debounced suggestions, keyboard navigation, and free-text fallback.
- [x] 4.4 Replace the hardcoded ticker list in `QuickOrderCard` with the search control and derive broker/category from the instrument type.
- [x] 4.5 MSW handler, fixture, component tests, and an integration test that searches, picks a symbol, and submits it.

## Notes

- `frontend/src/lib/datetime.ts` centralizes the local `datetime-local` value used for `occurred_at` by both entry points.
- `QuickOrderCard` derives its loading state (`symbol !== quotedTicker`) instead of writing state inside the quote effect, which keeps `react-hooks/set-state-in-effect` satisfied.
- Production bundle builds and the OpenAPI drift check passes; interactive demo-mode verification remains pending.

