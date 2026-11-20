"""Tests for sending pending alert crossings through a notifier."""

from datetime import datetime, timezone
from decimal import Decimal

from backend.app.application.alert_notifications import AlertNotificationUseCases
from backend.app.domain.alerts import AlertIntent, AlertScope, TriggeredAlert


def crossing(event_id: int) -> TriggeredAlert:
    """Build one persisted crossing for notification tests."""
    return TriggeredAlert(
        id=event_id,
        scope=AlertScope.PORTFOLIO,
        ticker="YPF",
        target_price=Decimal("150"),
        intent=AlertIntent.SELL,
        observed_price=Decimal("152.50"),
        message="Precio objetivo de venta alcanzado.",
        triggered_at=datetime(2026, 11, 20, 15, 30, tzinfo=timezone.utc),
        currency="ARS",
    )


class StubAlertEvents:
    """In-memory alert-event repository recording marks."""

    def __init__(self, pending):
        """Store the pending crossings this repository reports."""
        self.pending = list(pending)
        self.marked = []

    def list_unemailed_events(self):
        """Return the current pending crossings."""
        return tuple(self.pending)

    def mark_emailed(self, event_id, emailed_at):
        """Record that the crossing was emailed."""
        self.marked.append((event_id, emailed_at))
        return True


class StubUnitOfWork:
    """Minimal unit of work exposing only the alert-event repository."""

    def __init__(self, alert_events):
        """Bind the stub repository and start with no commits."""
        self.alert_events = alert_events
        self.commits = 0

    def __enter__(self):
        """Return this unit of work as the context value."""
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        """Never suppress exceptions from the caller."""
        return False

    def commit(self):
        """Count a commit."""
        self.commits += 1


class StubNotifier:
    """Notifier that records sends and can fail for selected events."""

    def __init__(self, fail_ids=()):
        """Store the event ids that must raise when sent."""
        self.fail_ids = set(fail_ids)
        self.sent = []

    def send(self, event):
        """Record the send or raise for a configured failing id."""
        if event.id in self.fail_ids:
            raise OSError("smtp down")
        self.sent.append(event.id)


def test_send_pending_emails_and_marks_every_crossing():
    """Each pending crossing is sent once and then marked as emailed."""
    events = StubAlertEvents([crossing(1), crossing(2)])
    notifier = StubNotifier()
    use_cases = AlertNotificationUseCases(lambda: StubUnitOfWork(events), notifier)

    sent = use_cases.send_pending()

    assert sent == 2
    assert notifier.sent == [1, 2]
    assert [event_id for event_id, _ in events.marked] == [1, 2]


def test_a_failed_send_leaves_the_event_unmarked_and_continues():
    """One SMTP failure does not block later events or mark the failed one."""
    events = StubAlertEvents([crossing(1), crossing(2), crossing(3)])
    notifier = StubNotifier(fail_ids={2})
    use_cases = AlertNotificationUseCases(lambda: StubUnitOfWork(events), notifier)

    sent = use_cases.send_pending()

    assert sent == 2
    assert notifier.sent == [1, 3]
    assert [event_id for event_id, _ in events.marked] == [1, 3]


def test_no_pending_crossings_sends_nothing():
    """An empty pending list is a successful no-op."""
    events = StubAlertEvents([])
    use_cases = AlertNotificationUseCases(
        lambda: StubUnitOfWork(events), StubNotifier()
    )

    assert use_cases.send_pending() == 0
