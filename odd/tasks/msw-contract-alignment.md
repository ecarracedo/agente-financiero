# Feature: MSW harness aligned with the OpenAPI contract

Objective: make `frontend/src/mocks/{handlers,fixtures}.ts` serve the real contract, so the
harness can replace `vi.mock` workspace by workspace (task 1.4) and back demo mode (task 5.1).
Branch: `dev`. Delivery: one work unit, single commit. Test runner: `npm test` (Vitest).

## Specs

- **S1. Every handler path exists in `frontend/openapi.json`.** A handler registered on a route
  the contract does not define is a defect, not a convenience. The invented routes to replace:
  `/api/v1/market/analysis/:ticker` → `/api/v1/analysis/{ticker}`;
  `/api/v1/market/portfolio` → `/api/v1/portfolio`;
  `/api/v1/market/transactions` → `/api/v1/transactions`;
  `/api/v1/market/wishlist` → `/api/v1/wishlist`;
  `/api/v1/alerts/portfolio` → `/api/v1/portfolio/{ticker}/alert`;
  `/api/v1/alerts/wishlist` → `/api/v1/wishlist/{ticker}/alert`;
  `/api/v1/tools/split` → `/api/v1/splits`;
  `/api/v1/health` → `/health`;
  `/api/v1/ready` → `/ready`.

- **S2. Every fixture matches its response schema, by field name and by type.** The contract
  fields, verbatim from `frontend/openapi.json`:
  - `CurrencyValuationResponse`: `currency`, `invested_value`, `market_value` (string|null),
    `gain_loss` (string|null), `gain_loss_percent` (string|null), `unpriced_tickers` (string[]).
    One entry per currency, not per ticker.
  - `BibliographyItemResponse`: `id` (integer), `title`, `author`, `year` (integer|null),
    `category`, `link` (string|null), `description` (string|null).
  - `SplitProjectionResponse`: `quantity`, `average_price`, `ratio`.
  - `AlertCheckResponse`: `current_price` (string), `event` (`TargetAlertEventResponse|null`),
    where `TargetAlertEventResponse` is `intent` (`AlertIntent`) and `message`.
  - `WishlistItemResponse`: `ticker`, `target_price` (string|null). Already correct.
  - `MutationResponse`: `deleted` (boolean). `UpdatedResponse`: `updated` (boolean).
    `ConfiguredResponse`: `configured` (boolean).
  - `MarketAnalysisResponse`: `series` items are `PricePointResponse` (`date`, `close`), and
    `signals` is a `string[]`. Already correct.

- **S3. Path parameter names match the contract.** `{item_id}` and `{transaction_id}`, not `:id`.
  Under MSW the literal parameter name only has to be consistent within the handler, but the
  contract is the source of truth and a mismatch hides a real route change.

- **S4. Every route the frontend calls has a handler.** The client is already correct; the
  handlers must cover `/api/v1/splits`, `/api/v1/portfolio/{ticker}/alert[/check]`,
  `/api/v1/wishlist/{ticker}/alert[/check]`, `/api/v1/analysis/{ticker}`, `/health`, `/ready`.

- **S5. A test proves the harness matches the contract.** It reads `openapi.json` and asserts
  every registered handler path exists in the contract, and every fixture satisfies the schema
  of the response it stands in for. This is what stops the drift from coming back.

- **S6. `onUnhandledFrame: 'error'` stays on.** A request the harness does not serve must fail
  loudly, which is the whole point of S1-S4.

## Tasks

- T1 — inspect the contract and record the real routes and schemas (S1, S2, S3, S4). Done, above.
- T2 — rewrite `fixtures.ts` to the schema shapes (S2).
- T3 — rewrite `handlers.ts` onto the real routes (S1, S3, S4).
- T4 — add `src/mocks/contract.test.ts` (S5).
- T5 — run the suite; confirm the harness serves every route the existing tests exercise.

## Log

- L1. "arreglemos 1.4" — fix the harness blocker so the `vi.mock` migration can start.
- L2. Investigated before writing. Found the damage is larger than the routes: every fixture
  shape is wrong too (`valuations`, `bibliography`, `splitResult`, `alerts*`). The handlers were
  written from guesses; no test exercised them, which is exactly what task 1.4 was meant to add.
- L3. The frontend client (`src/api/client.ts`, `src/features/*/[a-z]*Api.ts`) matches the
  contract exactly. Only the mocks were wrong, so nothing in production is affected.
- L4. `AlertIntent` is `NEUTRAL | STOP_LOSS | BUY | SELL`.
- L5. `alertApi.checkWishlist` sends no body, so the wishlist check handler takes no request body.
