# Tasks: Transaction Execution and Price Autofill

## Phase 1: TransactionForm Autofill & Defaults

- [ ] 1.1 Add smart defaults in `TransactionForm` (`occurred_at`, `currency`, `broker`, `category`).
- [ ] 1.2 Implement quote autofill in `TransactionForm` on ticker change/blur via `marketApi.getAnalysis`.
- [ ] 1.3 Add tests in `TransactionsWorkspace.test.tsx` verifying price autofill and defaults without breaking existing tests.

## Phase 2: QuickOrderCard Real Execution & Quotes

- [ ] 2.1 Connect ticker selection/input in `QuickOrderCard` to `marketApi.getAnalysis` for dynamic live pricing.
- [ ] 2.2 Implement real `api.createTransaction` submission in `QuickOrderCard` with error/success feedback.
- [ ] 2.3 Wire `onTransactionCreated` callback in `PortfolioWorkspace` to re-fetch portfolio data immediately.

## Phase 3: Verification & Docker Validation

- [ ] 3.1 Verify complete frontend test suite (`npm test`), `tsc -b`, and ESLint.
- [ ] 3.2 Verify interactive execution in demo mode and build production bundle (`npm run build`).
