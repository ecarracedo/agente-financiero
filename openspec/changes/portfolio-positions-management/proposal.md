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
- `financial-web-frontend`: the portfolio positions table requires Total, Variación and P&L columns from live quotes, inline editing of broker and asset type, a configurable broker/asset-type catalog in the settings workspace, automatic quote refresh with a visible countdown, a sell action per position, and an empty initial state.
- `financial-domain-api`: `PUT /api/v1/portfolio/{ticker}` updates a position's broker or asset type without touching its quantity, weighted average price, or currency.

## Approach

Derive Total, Variación and P&L on the client from `quantity`, `average_price` and the live quote. Remove the demo seed data from the mocks and the workspace defaults. Reuse the existing positions mutation for manual loading and add a position-update endpoint addressed by the position's business identity (`broker` and `category` as query parameters). Persist the broker and asset-type catalogs in `localStorage` and read them through one shared module. Apply inline edits optimistically so the selector never snaps back while the reload is in flight. Guard against `average_price` = 0 and against missing quotes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/features/portfolio/HoldingsTable.tsx` | Modified | Total, Variación and P&L columns; editable broker/asset type; sell action; quote refresh with countdown |
| `frontend/src/features/settings/SettingsPage.tsx` | New | Refresh interval, broker catalog and asset-type catalog |
| `frontend/src/features/portfolio/QuickOrderCard.tsx` | Modified | Read broker and asset-type selectors from the configurable catalog |
| `frontend/src/features/portfolio/PortfolioWorkspace.tsx` | Modified | Remove demo positions; empty state; manual add flow; pass quotes |
| `frontend/src/features/portfolio/AutoRefreshTimer.tsx` | New | Countdown to the next automatic quote refresh |
| `frontend/src/features/portfolio/PortfolioWorkspace.test.tsx` | Modified | Cover the empty state, the columns, the calculations and the refresh |
| `backend/app/api/routes.py`, `schemas.py`, `application/portfolio.py`, `application/ports.py`, `adapters/persistence/repositories.py` | Modified | `PUT /api/v1/portfolio/{ticker}` and `update_position` |
| Frontend mocks/fixtures | Modified/Removed | Clear hardcoded demo positions |

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
