# Feature: alerts simplified to asset + target price + type

Objective: reduce target alerts to asset + target price + type (Buy/Sell), list every configured
alert, prefill the panel with the saved alert, and allow removing an alert.
Branch: `dev`. Delivery: ask-on-risk, work-unit commits. Test runners: `python -m pytest backend/tests`
and `npm test` in `frontend/`.

## Specs

- **S1. An alert is asset + target price + type.** The only types are `BUY` and `SELL`
  (`AlertIntent`). User request, verbatim: "por el momento la alerta seria Activo + precio
  objetivo + tipo (Venta/Compra)". `NEUTRAL` and `STOP_LOSS` are removed from the domain enum.
- **S2. Direction per type.** `BUY` emits only on a downward crossing
  (`previous > target >= current`); `SELL` only on an upward crossing
  (`previous < target <= current`). Messages stay verbatim: `BUY` →
  "Precio objetivo de compra alcanzado.", `SELL` → "Precio objetivo de venta alcanzado.".
- **S3. Rows persisted with a removed type stay inactive.** No schema migration:
  `alert_intent` is a free-text column, and loading an unknown value yields no alert (existing
  behavior), so those rows behave as if no alert were configured.
- **S4. Every configured alert is listable.** `GET /api/v1/alerts` returns one `AlertResponse`
  per configured portfolio position and wishlist entry: `scope` (`portfolio`|`wishlist`),
  `ticker`, `broker`, `category`, `currency`, `target_price`, `intent`, `last_observed_price`.
  Deterministic order: portfolio before wishlist, ticker A→Z within each scope.
- **S5. An alert is removable without touching the position.** `DELETE
  /api/v1/portfolio/{ticker}/alert?broker=&category=` and `DELETE /api/v1/wishlist/{ticker}/alert`
  clear target price, type, and last observation, returning `{"deleted": true}`; 404 when no alert
  is configured. The portfolio position and the wishlist entry remain.
- **S6. The panel shows what is saved.** Selecting a target prefills its type and target price from
  the configured alert, and the workspace lists every configured alert so monitoring does not
  require opening each target one by one.
- **S7. Contract artifacts stay in sync.** `frontend/openapi.json` and
  `frontend/src/api/types.ts` are regenerated; `backend/tests/test_openapi_snapshot.py` and
  `npm run check:api-drift` pass.
- **S8. The MSW harness serves the new routes.** Handlers cover `GET /api/v1/alerts` and both
  DELETE routes, and `src/mocks/contract.test.ts` still passes.

## Tasks

- T1 — domain: `AlertIntent` reduced to BUY/SELL, crossing rules, messages (S1, S2, S3). RED→GREEN
  in `backend/tests/test_valuation_alerts.py`. Done.
- T2 — persistence: `clear_position_alert`, `clear_wishlist_alert`, `list_position_alerts`,
  `list_wishlist_alerts` plus port signatures (S4, S5). Tests in
  `backend/tests/test_target_alert_use_cases.py`. Done.
- T3 — use cases: `list_alerts`, `delete_portfolio_alert`, `delete_wishlist_alert` (S4, S5). Done.
- T4 — API: `AlertResponse` schema, `GET /api/v1/alerts`, both DELETE routes (S4, S5). API tests.
  Done.
- T5 — regenerate `frontend/openapi.json` and `frontend/src/api/types.ts`; both drift guards (S7).
  Done.
- T6 — frontend boundary: `alertApi.list` / `deletePortfolio` / `deleteWishlist`; MSW handlers and
  fixtures (S8). Done.
- T7 — frontend workspace and panel: configured-alert list, prefill, delete action, "Type" label
  (S6). Tests in `frontend/src/features/alerts/`. Done.
- T8 — docs: canonical OpenSpec requirements, `CHANGELOG.md` and `CHANGELOG_es.md` (S1, S4, S5).
  Done. README lists Streamlit features and does not document the HTTP API, so it stays unchanged.

## Log

- **L1** — User request, verbatim: "las alertas son para configurar un activo (Los que tengo en
  cartera y los que estan en whislist) llegue a un precio. por el momento la alerta seria Activo +
  precio objetivo + tipo (Venta/Compra) vamos con esto simple."
- **L2** — User request, verbatim: "Cualquier cosa extra que puedas aportar bienvenido"
- **L3** — User request, verbatim: "dale"
- **L4** — Scope decision: (a) reduce to Compra/Venta + prefill + delete, (b) global list; the
  automatic background evaluation (c) is deferred to a separate feature.
- **L5** — Assumption: UI copy stays in English (`Type`, `Buy`, `Sell`) because the whole workspace
  navigation and the alerts UI are already English; the crossing messages stay in Spanish exactly
  as they are.
- **L6** — Design decision: the read side is a separate projection. `ConfiguredAlert` (scope,
  ticker, broker, category, currency, target price, type, last observed price) is what listing
  returns; `TargetAlertSettings` stays the write model validated at configure time. Each repository
  answers with one query per scope (`list_position_alerts`, `list_wishlist_alerts`) instead of the
  use case walking every position and re-reading each alert, and rows whose stored intent no longer
  exists are skipped by the same projection that makes them produce no alert during a check.
- **L7** — Two latent accessibility defects found while testing the prefill: the workspace select
  and the panel target input both used `id="alert-target"`, and both sections used
  `aria-labelledby="alerts-heading"`. Renamed to `alert-position` and `target-alert-heading`.
- **L8** — Evidence, this work unit: backend `python -m pytest backend/tests` → 248 passed (includes
  `test_openapi_snapshot.py`); frontend `npm test` → 191 passed across 31 files; `npm run lint` and
  `npm run build` clean; `npm run check:api-drift` passed. RED was observed before each implementation
  step: the enum test failed with `{'BUY','NEUTRAL','STOP_LOSS','SELL'}`, the six use-case tests failed
  on missing methods, and the API tests failed with 404 on the new routes.
- **L9** — Environment note: the repository `venv/` has no `fastapi`, so backend tests were run from a
  throwaway environment created with `python3 -m venv /tmp/opencode/backend-venv` and
  `pip install -e "backend[test]"`, which mirrors the CI step.
- **L10** — Spec sync: `openspec/specs/financial-domain-api/spec.md` and
  `openspec/specs/financial-web-frontend/spec.md` described four intents; both requirements were
  rewritten to the two-type contract with listing and removal, because leaving them would state a
  contract the code no longer implements.
- **L11** — Risk: item 3 (the `AlertIntent` enum is part of the published API contract and the
  generated frontend types) and item 1 (alerts already stored with a removed value stop evaluating).
  Mitigation: the removal is read-safe by construction (`get_position_alert` and the listing
  projection both skip unknown values), no schema migration is needed because `alert_intent` is free
  text, and generated artifacts are regenerated rather than hand-edited.
