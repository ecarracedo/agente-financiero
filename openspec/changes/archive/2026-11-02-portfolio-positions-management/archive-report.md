# Archive Report: portfolio-positions-management

**Change**: portfolio-positions-management
**Archived**: 2026-11-02
**Verdict before archive**: PASS

## Result

"Posiciones en Cartera" now renders the real portfolio instead of demo fixtures, with
Total, Variación and P&L derived from live quotes, inline broker and asset-type editing,
a configurable catalog, a per-row sell action, filters, a visible quote-refresh countdown
and a recent-transactions card fed by the API.

The change grew past its original proposal while it was being applied: editing and the
catalog were added at the user's request, then filters, then the real recent transactions
card, and finally the blank-selector fix found during the archive audit. The proposal,
the two spec deltas and `tasks.md` were updated with each addition, and `design.md` was
written at archive time to record the decisions that were made along the way.

## Verification Evidence

- Backend tests: `python -m pytest backend/tests -q` → 193 passed
- Frontend tests: `npx vitest run` → 167 passed across 28 files
- Frontend type check: `npx tsc -b` → clean
- Frontend lint: `npm run lint` → 0 errors, 1 pre-existing warning in `QuickOrderCard`
- OpenAPI: `frontend/openapi.json` regenerated from `create_app().openapi()`;
  `backend/tests/test_openapi_snapshot.py` passes
- Live API on the rebuilt stack: `GET /api/v1/transactions?limit=3` returns the three
  newest operations across assets, `GET /api/v1/transactions?ticker=...&broker=...` still
  returns that asset's history, and `GET /api/v1/transactions?ticker=X` answers `422`
- Git commits: `0562d94`, `77c9fe3`, `d784b06`, `359db96` on `dev`

## Requirement Coverage

- Editable broker and asset type — met, including the optimistic revert and the
  stored-value-outside-the-catalog case.
- Configurable catalog — met: defaults, add, remove, duplicate rejection, corrupted
  storage fallback and the shared refresh interval.
- Automatic quote refresh — met: configurable interval, visible countdown, manual
  refresh, cache bypass, and a failed quote shown as unavailable.
- Position performance columns — met, with "—" for a missing quote.
- Sell a position — met, disabled while the quote is unknown.
- Filter the holdings table — met, with the filter-specific empty state.
- Recent transactions card — met: capped at three rows, newest first, with loading,
  error and empty states.
- `PUT /api/v1/portfolio/{ticker}` — met.
- `GET /api/v1/transactions` recent listing — met.

## Known Limitations

- The catalog is per-browser state, not a shared server catalog. A second browser starts
  from the defaults.
- A position cannot be deleted without selling it; removing an imported row that should
  never have existed remains a product decision.
- Positions created before this change can carry legacy category spellings (`CEDEAR`,
  `Stock`). They stay visible because of the catalog fallback, but the filter lists only
  the catalog values, so a legacy value cannot be selected in the filter.
- The refresh interval is read once per mount: changing it in Configuración while the
  portfolio is open remounts the table, which restarts the countdown and refetches.

## Canonical Specs Updated

- `openspec/specs/financial-web-frontend/spec.md`: 7 added requirements plus the
  "Portfolio starts without seeded positions" requirement.
- `openspec/specs/financial-domain-api/spec.md`: 2 added requirements.
