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
- `currency`: defaults to `'USD'` and follows the quote once one is fetched (see D8).
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
- `currency`: the currency reported by the quote (see D8).
- `occurred_at`: current ISO timestamp.

On success, it displays a success feedback badge and calls `onTransactionCreated()`, which increments `refreshToken` in `PortfolioWorkspace`, immediately refreshing holdings, summary metrics, and valuations.

### D5. Asset search lives in the backend, not in a hardcoded frontend list
The order ticket needs the real symbol universe, so `GET /api/v1/tickers/search?q=&limit=` wraps `yfinance.Search`. The domain owns the shape (`TickerMatch`), the port declares `search_symbols`, and the yfinance adapter maps provider quotes: it skips entries without a usable symbol, drops non-Yahoo results, collapses duplicates, and returns no matches when the provider fails. A provider failure must never block a manual symbol, so the endpoint answers `[]` with a 200 instead of an error.

### D6. Suggestions are debounced and never mandatory
`TickerSearch` is a combobox: the input is the source of truth, suggestions are a convenience. It queries after a 300 ms debounce and only from two characters up, so typing a symbol costs one request. Selecting a suggestion fills the ticker and the display name; a typed symbol with no suggestion is submitted unchanged. The quote lookup in the ticket is also debounced (400 ms) so typing does not trigger one historical download per keystroke.

### D7. Category and broker derive from the instrument type
The previous hardcoded ticker list decided broker and category. With free-text symbols, the ticket derives the category from the provider instrument type (`Cryptocurrency`/`Currency` → `Cripto`, `ETF` → `ETF`, otherwise `Stock`) and picks `Binance` for crypto and `IBKR` otherwise.

### D8. One provider snapshot answers price and currency
Hardcoding `currency: 'USD'` recorded an Argentine listing quoted in pesos as dollars, which silently mixed two currencies inside one valuation group. The port now exposes `get_quote(ticker) -> QuoteSnapshot | None` (price plus currency) instead of `get_current_price`, so both fields come from a single `.info` read and can never disagree. The adapter normalizes the provider field to an upper-cased three-letter ASCII code and reports anything else as unknown, because a guess is worse than an explicit gap.

`MarketAnalysis` and `MarketAnalysisResponse` carry `currency`, so the analysis endpoint answers "what is this quoted in" without a second call. Both frontend entry points adopt it: `QuickOrderCard` shows it beside the price and the estimated total and submits it, and `TransactionForm` fills the editable currency field from the quote. US dollars remain the fallback when the provider reports nothing, and the user can still overwrite the field in the full form.

## Data Flow

```
[User interacts with QuickOrderCard / TransactionForm]
        │
        ├── Ticker changed ──▶ marketApi.getAnalysis(ticker, '1mo')
        │                          ├── current_price ──▶ unit_price
        │                          └── currency      ──▶ ticket currency
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
