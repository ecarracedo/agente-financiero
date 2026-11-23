# Market data latency and wishlist analysis

Objective: reduce repeated yfinance work and add wishlist price history with monthly variation. Branch: dev. Delivery: work units on dev (no PR requested; delivery strategy `exception-ok` because no chain/PR applies). Test runners: backend `python -m pytest backend/tests -q`, frontend `npx vitest run`, `npm run build`, `npm run lint`, `npm run check:api-drift`.

## Specs
- S1: BACKLOG item 5, verbatim: "Refactor Market Data: Optimize `yfinance` calls to reduce latency." Add a short-lived cache (default TTL 15 minutes) inside `CompositeMarketDataProvider` for yfinance quote information, quote results and historical series. The clock and TTL must be injectable for deterministic tests; only successful results are cached, failures are retried on the next call, and no public method signature changes.
- S2: Repeated `get_quote(ticker)` calls for the same normalized ticker must invoke the yfinance factory at most once within one TTL window; after the window elapses the provider refreshes once. PPI-first behavior and per-100 nominal scaling stay unchanged.
- S3: Repeated `get_historical_series(ticker, period)` calls must invoke `history()` at most once per `(ticker, period)` within one TTL window, and must reuse cached `.info` for per-100 bond detection instead of asking yfinance again.
- S4: BACKLOG item 7, verbatim: "Wishlist Analysis: Show price history (3, 6, 12 months) and monthly variation." Add `GET /api/v1/wishlist/{ticker}/history?period=<3mo|6mo|1y>`. A ticker absent from the wishlist yields 404; a successful response returns chronological `{date, close}` points plus canonical string percentages.
- S5: Monthly variation is the percent change between the last close of the previous calendar month and the last close of the latest calendar month in the returned series; it is `null` when fewer than two months are present. Period variation is the first-to-last close change; it is `null` with fewer than two points. Percentages are returned as plain canonical strings without a currency symbol; the frontend formats them for es-AR display.
- S6: The wishlist workspace gains a per-row "Analyze" action (keeping the workspace's existing English UI copy) and a compact analysis card that reuses `QuickOrderCard` visual tokens, a segmented `3M / 6M / 12M` selector, and `MarketChart` for the line series. Loading, empty and error states are explicit; errors use `role="alert"` and `text-xs font-mono text-[#ffb4ab]`.
- S7: Contract artifacts stay consistent: regenerate `frontend/openapi.json` from the live app, regenerate `frontend/src/api/types.ts`, add the MSW handler and fixture, and keep `contract.test.ts`, `check:api-drift` and the OpenAPI snapshot test green.
- S8: Documentation: mark both BACKLOG items done and add entries to `CHANGELOG.md` and `CHANGELOG_es.md` under `[Unreleased]`.

Assumption (not specified by the user): frontend labels `3M / 6M / 12M` map to provider periods `3mo / 6mo / 1y`, matching the existing analysis endpoint vocabulary. Assumption: the monthly-variation formula in S5 is the working definition of "monthly variation".

## Tasks
- T1 — S1, S2, S3 — delegated worker A (inline-compatible backend unit, parallel with T2) — done, commit `8025441`.
- T2 — S4, S5, S6, S7 — delegated worker B (full-stack wishlist unit, parallel with T1) — done, commit `da8b327`.
- T3 — S8 — inline documentation closure after T1 and T2 were verified — done, documented in this feature's documentation commit.

## Risk
Risk: none by the Task Size list. T1 changes shared provider internals but keeps every public signature and only adds cached freshness bounded by a documented TTL; T2 adds a new endpoint and UI without changing or removing existing contracts. Both units add deterministic tests, including coverage that previous provider behavior and existing wishlist CRUD still hold.

## Log
- L1 — User request, verbatim: "me interesa punto 5 y 7", after choosing from the open BACKLOG items: "Refactor Market Data: Optimize `yfinance` calls to reduce latency." and "Wishlist Analysis: Show price history (3, 6, 12 months) and monthly variation."
- L2 — Explored before writing. `CompositeMarketDataProvider` (backend/app/adapters/composite_market_data.py) already caches `yfinance.Ticker` objects but calls `.info` and `.history()` on every request; its 9 callers and `backend/tests/test_composite_market_data.py` constrain any change. The wishlist CRUD lives in `backend/app/api/routes.py` and `frontend/src/features/wishlist/`; the existing `MarketChart` and `toChartSeries` can render the new series, and `frontend/openapi.json` is guarded by `backend/tests/test_openapi_snapshot.py`.
- L3 — Route decision: two delegated writers in parallel, one per independent behavior with disjoint edit surfaces (T1 backend adapter/tests; T2 wishlist backend + frontend + contract artifacts). The parent owns git, the feature document, documentation and all final checks. No independent verifier: the risk line names no high-risk item.
- L4 — T1 evidence: RED with 5 new tests failing on the base provider (`TypeError` on injected `cache_ttl_seconds`/`clock`); GREEN 11/11 in `test_composite_market_data.py`. Parent spot check: base tests pass unchanged against both base and changed code (6/6 each). Commit `8025441`.
- L5 — T2 evidence: RED with 3 backend tests returning `{'detail': 'Not Found'}` and 4 frontend tests missing the "Analyze" action; GREEN 4/4 backend, all wishlist/mocks frontend tests. Full checks: backend 307 passed, frontend 208 passed, build/lint/api-drift clean. Commit `da8b327`.
- L6 — Parent final checks: differential base tests against changed backend (`test_api.py`, `test_resource_use_cases.py`) 30 passed; full backend 307 passed; full frontend 208 passed plus build, lint and `check:api-drift`. `gentle-ai review assess` with untracked feature doc excluded returned `risk: medium`, `review_due: false`, `under_budget`; boundary stays `a6f815c`.
- L7 — Documentation closure (T3): BACKLOG items 5 and 7 marked done; English and Spanish changelogs updated under `[Unreleased]`. Remaining: sync with GitHub and close/archive this feature document under the end-of-session ritual or explicit user instruction. Risk: none; the feature stays within the original risk line.
