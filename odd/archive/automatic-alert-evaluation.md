# Feature: automatic alert evaluation

Objective: evaluate every configured target alert in the background and persist the crossings it
finds, so an alert fires without opening the app and clicking "Check alert".
Branch: `dev`. Delivery: ask-on-risk, work-unit commits. Test runners: `python -m pytest
backend/tests` and `npm test` in `frontend/`.

## Specs

- **S1. Evaluation runs on its own.** A background scheduler in the API process evaluates every
  configured alert (portfolio and wishlist) on a fixed poll interval, using the same
  `evaluate_target_alert` crossing rules the on-demand check uses. It must never make the API
  process fail: an exception is logged once and the loop continues. User request, verbatim:
  "c".
- **S2. One quote per ticker per pass.** A ticker monitored in both the portfolio and the wishlist
  costs one quote, not two, and a provider that returns no quote for a ticker skips only that
  ticker.
- **S3. A crossing is persisted as an event.** Each detected crossing is stored with its scope,
  ticker, broker, category, currency, target price, type, observed price, message, and the moment
  it was detected. Crossing detection keeps its existing state machine, so one crossing produces
  exactly one event and a price that stays beyond the target produces no repeat.
- **S4. Triggered events are listable and acknowledgeable.** `GET /api/v1/alerts/events` returns
  pending events newest first and accepts `include_acknowledged`; `POST
  /api/v1/alerts/events/{event_id}/acknowledge` marks one as acknowledged (200) or reports 404.
  Acknowledging an event never touches the alert or the position. Verbatim acceptance from the
  user for this style of "extra": "Cualquier cosa extra que puedas aportar bienvenido".
- **S5. A pass can be requested on demand.** `POST /api/v1/alerts/evaluate` runs one evaluation pass
  and returns the events it just recorded, so the UI can refresh without waiting for the poll.
- **S6. The workspace shows what fired.** The alerts workspace lists triggered events with ticker,
  message, observed price and detection time, offers an acknowledge action per event, and a
  "Check now" action that runs a pass.
- **S7. Nothing evaluates by accident in tests.** `create_app` accepts
  `alert_scheduler_enabled`, defaulting to on for the real app, and the API test fixture disables
  it so no test reaches the network.
- **S8. Contract artifacts and docs stay in sync.** `frontend/openapi.json` and
  `frontend/src/api/types.ts` are regenerated, both drift guards pass, and `CHANGELOG.md`,
  `CHANGELOG_es.md` and the canonical OpenSpec specs describe the new behavior.
- **S9. Scope lives inside the quick creator.** Verbatim user request: "Dentro de Creador de alerta, tiene que seleccionar scope y dependiendo de la seleccion otro campo con la posicion si es cartera, con whishlist lo mismo y si quiero buscar un activo que me permita buscarlo igual que cuando busco un activo en registrar transacciones". The detached page-level scope control is removed: "ese scope que hay ahi no me gusta". Cartera and Wishlist show only their own items; "Otro activo" uses the same `TickerSearch` provider lookup as transaction entry.
- **S10. The current quote is visible at target time.** Verbatim user request: "En target Alert cuando elijo el precio me tiene que aparecer la cotizacion actual". The selected asset's live quote is displayed in the Target alert panel and prefills the target price when no saved alert exists; a user edit takes precedence.

## Tasks

- T1 — ✅ done (`a167312`) — domain and persistence: `TriggeredAlert`, `AlertEventRecord`, migration `a0008_alert_events`,
  `SqlAlchemyAlertEventRepository`, port and unit-of-work wiring (S3). Tests in
  `backend/tests/test_alert_events.py`.
- T2 — ✅ done (`a167312`) — use cases: `evaluate_alert`, `list_events`, `acknowledge_event` on `TargetAlertUseCases`
  (S3, S4).
- T3 — ✅ done (`44c6b2e`) — monitor: `AlertMonitorUseCases.evaluate_all` with one quote per ticker and per-ticker
  failure isolation (S1, S2). Tests in `backend/tests/test_alert_monitor.py`.
- T4 — ✅ done (`44c6b2e`) — scheduler: `TargetAlertScheduler` with poll, single-error logging, and lifespan wiring plus
  `alert_scheduler_enabled` (S1, S7). Tests in `backend/tests/test_alert_scheduler.py`.
- T5 — ✅ done (`284a096`) — API: response schema plus the three routes (S4, S5). Tests in `backend/tests/test_api.py`.
- T6 — ✅ done (`284a096`) — regenerate `frontend/openapi.json` and `frontend/src/api/types.ts` (S8).
- T7 — ✅ done (`01ed5e4`) — frontend: `alertApi.listEvents/acknowledgeEvent/evaluate`, MSW handlers and
  fixtures, and the workspace triggered list with acknowledge and "Check now" (S6). Tests in
  `frontend/src/features/alerts/`.
- T8 — ✅ done (`29eaa06`) — docs: `CHANGELOG.md`, `CHANGELOG_es.md`, canonical OpenSpec requirements (S8).
- T9 — ✅ done (`b5f734c`) — consumer UI: compact scope control inside the quick-creation card, scope-dependent position/wishlist/asset-search field, and the live quote shown and prefilled in Target alert (S6, S9, S10). Tests in `frontend/src/features/alerts/` and `frontend/src/app/routes.test.tsx`.
- T10 — ✅ done (`29aabbd`) — UI baseline: `AGENTS.md` rule 7 declares `QuickOrderCard.tsx` the visual reference; the alerts creator, Target panel and shared field controls were aligned to its spacing and typography through an additive `density="compact"` variant (S9, S10). Tests in `frontend/src/components/FormControls.test.tsx`.

## Log

- **L1** — User request, verbatim: "c" — the deferred option (c): automatic background evaluation
  with a scheduler like the existing daily snapshot scheduler.
- **L2** — Scope decision: crossings are persisted as in-app events and surfaced in the alerts
  workspace. No external notification channel (email, Telegram, push) is added, because the project
  has no notification infrastructure or credentials and the app is a single-user local deploy; the
  scheduler runs inside the API process, so the result is waiting when the user opens the app.
- **L3** — Design decision: a new `alert_events` table instead of columns on the alert rows, so the
  history of firings survives and acknowledging one event does not erase the alert. The existing
  `last_observed_price` state machine already guarantees one event per crossing, so no dedupe key
  is needed.

- **L4** — Implementation evidence (2026-11-19): T1–T6 landed in three work-unit commits —
  `a167312` (persistence, `TriggeredAlert`, migration `a0008_alert_events`, crossings stored by
  `evaluate_portfolio_alert`, `evaluate_wishlist_alert` and `evaluate_alert`), `44c6b2e`
  (`AlertMonitorUseCases` with one quote per ticker and per-ticker isolation, `TargetAlertScheduler`
  poll loop, `alert_scheduler_enabled` lifespan wiring) and `284a096` (three routes, response
  schemas, regenerated `frontend/openapi.json` and `frontend/src/api/types.ts`).
  `python -m pytest backend/tests` → **282 passed**, including the API drift guard. T7 landed in
  `01ed5e4` (workspace shows triggered events, Acknowledge action, "Check now";
  `npx vitest run src/features/alerts` → 6/6 passed; `npm run lint` clean; `npm test` full suite
  passes except a pre-existing flaky `AssetDistributionCard` test that also fails at baseline
  without these changes).

- **L5** — User request, verbatim: "Dentro de Creador de alerta, tiene que seleccionar scope y dependiendo de la seleccion otro campo con la posicion si es cartera, con whishlist lo mismo y si quiero buscar un activo que me permita buscarlo igual que cuando busco un activo en registrar transacciones"; "ese scope que hay ahi no me gusta"; "En target Alert cuando elijo el precio me tiene que aparecer la cotizacion actual".
- **L6** — T9 evidence (2026-11-19): removed the detached top-of-page scope bar; the card now owns a three-way segmented scope control and shows only the matching dependent field, reusing `TickerSearch` for "Otro activo". The quote from `marketApi.getAnalysis` is passed to `AlertsPanel` as `initialTargetPrice` and rendered as "Cotización actual"; a user edit wins over the quote, and a saved alert wins over both. `npx vitest run src/features/alerts` → 23/23; `npx vitest run --maxWorkers=1` → 198/198; `npm run lint` clean; `python -m pytest tests -q` → 282 passed (from `backend/`). The parallel full suite still shows an intermittent `AssetDistributionCard` timing failure present at baseline. RDD assess (`--base-ref 891a75e --committed-only`): `medium` / `under_budget`, `review_due: false`, so no review lifecycle was started for this slice.

- **L7** — User request, verbatim: "fijate el UI de registro de transacciones si podemos igualarlo a Creacion de alertas, sobre todo espaciado y tipografia"; "Registrar transacciones seria el baseline para todo. Hay que agregarlo como Regla"; "Dale".
- **L8** — T10 evidence (2026-11-19): the quick-creation card now uses the `QuickOrderCard.tsx` container/header tokens, a 10px mono label scale, 12px mono controls on `#1c2028`, the segmented scope control and the cyan primary button. `TextField`/`SelectField` gained an additive `density="compact"` variant — their defaults and 17 other callers are untouched. Giving compact field errors `role="alert"` was reverted: `findByRole('alert')` then matched both the field error and the form-level `ErrorState`; the latter stays the single alert. `npx vitest run src/features/alerts src/components/FormControls.test.tsx --maxWorkers=1` → 30/30; `npx vitest run --maxWorkers=1` → 200/200; `npm run lint` clean. RDD assess on the uncommitted slice: `medium` / `under_budget`, `review_due: false`.
- **Closure** (2026-11-19): S1–S10 covered by T1–T10; all work-unit commits on `dev`. Backend 282/282, frontend 200/200, lint clean, both drift guards and RDD assess accounted for. Risk: none — the `density` prop is additive and its default preserves the shared controls' behavior; the full suite confirms no regression in the other 17 callers. Ready for archive.
