# Design: Transaction Execution and Price Autofill

## Context

The backend already supports atomic transaction recording (`POST /api/v1/transactions`), recalculating weighted average purchase prices and updating holdings. It also supports quoting current prices via `GET /api/v1/analysis/{ticker}`. In the frontend, transactions require typing every single field manually, and the dashboard's `QuickOrderCard` only had visual mock state.

## Decisions

### D1. Use `marketApi.getAnalysis(ticker, '1mo')` for market quotes
Instead of introducing new endpoints or changing the OpenAPI schema, the frontend queries the existing analysis endpoint. When `current_price` is non-null, it populates `unit_price`.

### D2. Non-blocking autocompletion with user override
The autocompletion triggers when the ticker is selected or blurred (or when selecting an asset in `QuickOrderCard`). If fetching fails or the ticker is unknown, the form logs no critical failure; the user remains free to input any price manually.

### D3. Form Defaults
To reduce cognitive friction:
- `occurred_at`: defaults to local current date-time string (`YYYY-MM-DDTHH:mm`).
- `currency`: defaults to `'USD'`.
- `broker`: defaults to `'IBKR'`.
- `category`: defaults to `'Stock'`.

### D4. Real Transaction Submission from `QuickOrderCard`
`QuickOrderCard` accepts an `onTransactionCreated?: () => void` callback.
On submit, it builds a `TransactionRequest`:
- `ticker`: uppercase selected/typed ticker.
- `broker`: `'IBKR'` (or matched position broker).
- `category`: `'Stock'` (or matched category, e.g., `'Cripto'` for BTC).
- `operation_type`: `'BUY'` | `'SELL'`.
- `quantity`: string.
- `unit_price`: string.
- `currency`: `'USD'`.
- `occurred_at`: current ISO timestamp.

On success, it displays a success feedback badge and calls `onTransactionCreated()`, which increments `refreshToken` in `PortfolioWorkspace`, immediately refreshing holdings, summary metrics, and valuations.

## Data Flow

```
[User interacts with QuickOrderCard / TransactionForm]
        │
        ├── Ticker changed ──▶ marketApi.getAnalysis(ticker, '1mo') ──▶ updates unit_price
        │
        └── Click "Registrar Transacción"
                │
                ▼
        api.createTransaction(payload)
                │
                ├── Backend updates DB & portfolio positions
                │
                ▼
        onTransactionCreated() callback
                │
                ▼
        increments version ──▶ usePortfolio() refetches
                │
                ▼
        HoldingsTable & PortfolioSummary update in real-time
```
