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
- T7 — pending — frontend: `alertApi.listEvents/acknowledgeEvent/evaluate`, MSW handlers and fixtures, and
  the workspace triggered list with acknowledge and "Check now" (S6).
- T8 — pending — docs: `CHANGELOG.md`, `CHANGELOG_es.md`, canonical OpenSpec requirements (S8).

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
  `python -m pytest backend/tests` → **282 passed**, including the API drift guard. T7 (frontend
  workspace) and T8 (CHANGELOG/OpenSpec) remain open.
