# Design: Portfolio Positions Management

## Context

"Posiciones en Cartera" was a read-only table over demo fixtures. The backend already
served real positions with `quantity`, `average_price` and `currency`, and already
exposed `POST /api/v1/transactions`, so the work was concentrated in the frontend: real
rows, computed performance, per-row editing and a way to sell. Two cross-cutting
questions had to be answered first — where the broker and asset-type vocabularies live,
and how a refreshed quote reaches a row that already shows a price.

## Decisions

### D1. Derive performance on the client, not in the API

Total, Variación and P&L are pure functions of `quantity`, `average_price` and the live
quote. Computing them in the frontend keeps the API contract unchanged and lets a
missing quote render "—" instead of forcing the backend to invent a value. `average_price`
is the cost basis, so the weighted-average algorithm stays untouched.

### D2. One catalog module, persisted locally

Brokers and asset types were hardcoded in `HoldingsTable` and again in `QuickOrderCard`,
which meant two lists that could drift. A single module (`catalogSettings.ts`) owns both
lists, persists them in `localStorage`, and both consumers read it through
`useSyncExternalStore`. Local storage, not the database: the catalog is a per-browser
preference, it needs no server round-trip, and it works in demo mode.

Rejected: a backend catalog endpoint. It would have added a table, a migration and an
API surface to solve a presentation concern, and the app already treats the position's
`broker`/`category` as free-form business values.

### D3. Optimistic inline edits with a scoped revert

The credential select is driven by server state. Writing the new value and re-reading it
on the next reload made the control snap back for the duration of the request, which read
as "the change did not register". The row keeps a draft keyed by
`ticker|broker|category`; the draft wins over the server value while the request is in
flight and is dropped only if the request fails. The key includes the position identity so
an edit cannot leak onto a different row.

### D4. Sell, not delete

The only way to close a position is recording a SELL for its full quantity at the current
quote, because that is what preserves history and the realized result. A delete endpoint
would have bypassed the transaction ledger. The action is disabled while the quote is
unknown: selling at an invented price would corrupt the realized result.

### D5. The catalog memo is keyed by the stored text

`useSyncExternalStore` needs a stable array identity between renders, so the parsed
catalog is memoized. Keying the memo by "already read" made it miss a `localStorage`
change made by another path, including a test or a cleared storage. The memo now stores
the raw text it parsed and recomputes when that text differs.

### D6. A stored value outside the catalog stays selectable

The catalog is editable, and existing rows predate it. A `<select>` whose `value` matches
no `option` renders blank, so removing "Acciones" in Configuración blanked every stock
row. The stored value is prepended to the option list when the catalog omits it. The
alternative — rejecting unknown values on save — would have broken rows the user never
touched.

### D7. Extend `GET /api/v1/transactions` instead of adding an endpoint

The dashboard needs the newest operations across the whole portfolio, while a position
drill-down needs one asset's history. Two shapes of the same resource became one endpoint:
`ticker` + `broker` keeps the chronological history, neither returns the newest operations
bounded by `limit`. Supplying only one is rejected with `422` rather than guessed, because
a ticker alone has no broker-scoped history to return.

### D8. The countdown owns its cycle

`AutoRefreshTimer` both renders the remaining time and calls `onElapsed` once per full
interval. It is remounted with a new `key` to restart the countdown, which avoids an
effect that writes state on mount — the pattern the project's lint rules reject.

## Data flow

```text
localStorage ──► catalogSettings ──► HoldingsTable / QuickOrderCard selects
                                          │
GET /api/v1/portfolio ────────────────────┤ rows
GET /api/v1/analysis/{ticker} ────────────┤ quote per ticker ──► Total / Variación / P&L
                                          │
PUT /api/v1/portfolio/{ticker} ◄──────────┘ draft then commit, revert on failure
POST /api/v1/transactions    ◄───────────── "Vender" (SELL, full quantity, current price)

GET /api/v1/transactions?limit=3 ──► RecentExecutionsCard
```

## Rejected alternatives

- **Server-side totals and variations**: duplicates business rules the API already exposes
  as inputs, and cannot represent "quote unavailable" without a nullable money field.
- **A modal for editing broker/asset type**: costs a click and hides the rest of the row
  while the user is comparing positions.
- **Refreshing quotes through a WebSocket**: the interval is a user preference measured in
  minutes; a streaming transport would be plumbing without a current consumer.

## Verification

- Backend: `python -m pytest backend/tests -q` → 193 passed.
- Frontend: `npx vitest run` → 167 passed across 28 files.
- Frontend: `npm run lint` (one pre-existing warning) and `npx tsc -b` clean.
- Contract: `frontend/openapi.json` regenerated from `create_app().openapi()` and checked by
  `backend/tests/test_openapi_snapshot.py`.
