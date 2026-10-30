# Proposal: Transaction Execution and Price Autofill

## Intent

Streamline transaction logging by autocompleting current market prices from `yfinance` via the market analysis API and enabling quick trade execution directly from the portfolio dashboard. Users currently must manually type unit prices, timestamps, currencies, brokers, and categories, and the dashboard's quick order card is not connected to the real transaction backend.

## Scope

### In Scope
- Autocomplete unit price from `yfinance` in `TransactionForm` when a ticker is entered or selected.
- Provide intelligent defaults for new operations: current timestamp, currency (USD), default broker (IBKR), and category (Stock).
- Connect `QuickOrderCard` on the Portfolio dashboard to the real `api.createTransaction` workflow.
- Refresh portfolio holdings, summary metrics, and valuations immediately after transaction execution.
- Maintain MSW test mocks and update Vitest suite with full coverage for autocompletion and quick order execution.

### Out of Scope
- Direct FIX or broker order routing (app is read/log aggregator, not a broker gateway).
- New backend endpoints or database schema alterations (existing `/api/v1/analysis/{ticker}` and `/api/v1/transactions` suffice).

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `financial-web-frontend`: Add price autocompletion on ticker selection, form defaults, and dashboard quick-order transaction execution with immediate portfolio refresh.

## Approach

1. In `TransactionForm`, invoke `marketApi.getAnalysis(ticker, '1mo')` on ticker change/blur. When `current_price` is returned, populate `unit_price` while leaving it user-editable. Pre-populate `occurred_at` with local ISO date-time if blank.
2. In `QuickOrderCard`, fetch real quotes for the selected asset, calculate estimated totals, and invoke `api.createTransaction` on submit.
3. Pass a refresh callback or signal in `PortfolioWorkspace` so that submitting a quick order immediately triggers `usePortfolio` re-fetch.
4. Support both offline test mode (MSW) and live dev mode (`VITE_DEMO=1`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/features/transactions/TransactionForm.tsx` | Modified | Price autocompletion and defaults |
| `frontend/src/features/portfolio/QuickOrderCard.tsx` | Modified | Real execution wiring and quote fetching |
| `frontend/src/features/portfolio/PortfolioWorkspace.tsx` | Modified | Portfolio refresh integration |
| `frontend/src/features/transactions/TransactionsWorkspace.test.tsx` | Modified | Tests for price autocompletion |
| `frontend/src/features/portfolio/PortfolioWorkspace.test.tsx` | Modified | Tests for quick order execution |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ticker quote network delay or rate limit | Med | Keep price field editable; show unobtrusive loading/fallback without blocking manual entry. |
| Stale portfolio data after quick order | Low | Trigger immediate version/refetch on successful mutation. |

## Rollback Plan

Revert `TransactionForm.tsx`, `QuickOrderCard.tsx`, and `PortfolioWorkspace.tsx` to prior git commit. No backend or database state is affected.

## Dependencies

- Existing backend endpoints: `GET /api/v1/analysis/{ticker}` and `POST /api/v1/transactions`.

## Success Criteria

- [ ] Typing or selecting a ticker in `TransactionForm` populates its current market price.
- [ ] Submitting a transaction via `QuickOrderCard` creates the transaction and updates portfolio holdings immediately.
- [ ] Suite passes 100% of frontend tests with zero TypeScript or linting regressions.
