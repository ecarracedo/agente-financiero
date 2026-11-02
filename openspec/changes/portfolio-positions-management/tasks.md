# Tasks: Portfolio Positions Management

## 1. Empty initial state

- [x] 1.1 Remove hardcoded positions from the demo fixtures; serve an empty holdings list.
- [x] 1.2 Keep the empty state named by the table caption.

## 2. Position performance columns

- [x] 2.1 Add Total, Variación and P&L columns computed from the live quote and `average_price`.
- [x] 2.2 Render "—" when the quote is unavailable instead of a number.
- [x] 2.3 Rename the price headers to "Ponderado" and "Actual".
- [x] 2.4 Cover the columns with a view test.

## 3. Editable broker and asset type

- [x] 3.1 Add `PUT /api/v1/portfolio/{ticker}` with `PortfolioPositionUpdateRequest` to the backend.
- [x] 3.2 Add `update_position` to the repository port, the adapter and the use cases.
- [x] 3.3 Regenerate the OpenAPI snapshot from the live application schema.
- [x] 3.4 Replace the static broker and asset-type cells with selectors.
- [x] 3.5 Apply the selection optimistically and revert it when the request fails.
- [x] 3.6 Title the asset-type column "Activo".

## 4. Configurable catalog

- [x] 4.1 Persist the broker and asset-type catalogs in `localStorage` with sane defaults.
- [x] 4.2 Add catalog editors to the settings workspace.
- [x] 4.3 Read both catalogs from the holdings table and the quick order card.

## 5. Quote refresh

- [x] 5.1 Refresh quotes automatically on a configurable interval, defaulting to 5 minutes.
- [x] 5.2 Show the remaining time until the next refresh and restart it on a manual refresh.
- [x] 5.3 Let a refreshed quote replace a previously displayed one.
- [x] 5.4 Bypass the browser HTTP cache on quote requests.
- [x] 5.5 Show the last successful update time.

## 6. Sell a position

- [x] 6.1 Add a "Vender" action that sells the whole position at the current quote.
- [x] 6.2 Refresh the portfolio after a successful sale.

## 7. Filtering

- [x] 7.1 Add ticker, asset-type and broker filters above the holdings table.
- [x] 7.2 Show a filter-specific empty state and a clear-filters action.
- [x] 7.3 Cover the filters with a view test.

## 8. Verification

- [x] 8.1 Backend suite passes.
- [x] 8.2 Frontend suite passes.
- [x] 8.3 Frontend lint and typecheck are clean.
