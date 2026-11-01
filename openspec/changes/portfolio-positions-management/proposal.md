# Proposal: Portfolio Positions Management

## Intent

The portfolio view ships with hardcoded demo positions, so users cannot see their real holdings. "Posiciones en Cartera" also lacks per-position value and performance. We need to start from an empty portfolio, let users load assets manually, and show Total and Variación computed from live quotes.

## Scope

### In Scope
- Remove hardcoded demo positions (mocks/fixtures/defaults); the portfolio starts empty with an empty state.
- Manual asset loading (symbol, quantity, price) through the existing positions API.
- New columns in `HoldingsTable`:
  - **Total** = quantity × current price.
  - **Variación** = (current − average_price) / average_price, shown as a %.
- Use backend `average_price` (weighted average, already exists) as the cost basis.
- Integrate the columns with live quotes. If a quote is missing, show "—" instead of a number.
- Update tests and fixtures to cover the new behavior.

### Out of Scope
- Changes to the weighted-average algorithm in the backend.
- Broker import and CSV import.
- Realized P&L, multi-currency conversion and historical charts.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `financial-web-frontend`: the portfolio positions table requires Total and Variación columns, live-quote integration, an empty initial state, and manual loading. Demo data is no longer shown by default.
- `financial-domain-api`: only if the positions endpoint needs adjusting. Verify during design; no change is expected.

## Approach

Derive Total and Variación on the client in pure helper functions. Inputs are `quantity`, `average_price` and the live quote price. Remove the demo seed data from the mocks and the workspace defaults. Keep the demo data only in test fixtures. Reuse the existing quote hook/service and the existing positions mutation for manual loading. Guard against `average_price` = 0 and against missing quotes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/features/portfolio/HoldingsTable.tsx` | Modified | Add Total and Variación columns; handle missing quotes |
| `frontend/src/features/portfolio/PortfolioWorkspace.tsx` | Modified | Remove demo positions; empty state; manual add flow; pass quotes |
| `frontend/src/features/portfolio/PortfolioWorkspace.test.tsx` | Modified | Cover the empty state, the columns and the calculations |
| Frontend mocks/fixtures | Modified/Removed | Clear hardcoded demo positions |
| Backend positions/quotes API | Maybe | Only if quote data or the `average_price` field is missing from the response |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Live quote unavailable or delayed | Med | Show "—" and keep the table usable |
| Division by zero when `average_price` = 0 | Low | Guard the calculation and show "—" |
| Existing tests depend on demo data | Med | Move the data into test-only fixtures |
| Stale `average_price` after new purchases | Low | Refetch positions after a mutation |

## Rollback Plan

Revert the change commit(s). This restores the demo seed data and removes the new columns. No database migration is involved, so no data rollback is needed.

## Dependencies

- Existing positions endpoint, which provides `average_price` as a weighted average.
- Existing live quotes integration.

## Success Criteria

- [ ] A fresh load shows an empty portfolio with no demo positions.
- [ ] A user can add an asset manually and see it in the table.
- [ ] Total equals quantity × current price.
- [ ] Variación equals (current − avg) / avg, shown as a %.
- [ ] Missing quotes and a zero average price render "—" without errors.
- [ ] The frontend test suite passes with updated fixtures.
