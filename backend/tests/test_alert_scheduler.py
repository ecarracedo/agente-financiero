"""Tests for the background scheduler that evaluates every alert."""

from backend.app.application.alert_scheduler import TargetAlertScheduler


class StubMonitor:
    """Record each pass and fail on demand."""

    def __init__(self, error=None):
        """Store the optional failure each pass must raise."""
        self.error = error
        self.passes = 0

    def evaluate_all(self):
        """Run one pass, raising the configured failure first."""
        self.passes += 1
        if self.error is not None:
            raise self.error
        return ()


def test_tick_runs_one_evaluation_pass():
    """A tick delegates the whole pass to the monitor."""
    monitor = StubMonitor()

    TargetAlertScheduler(monitor).tick()

    assert monitor.passes == 1


def test_a_failed_tick_never_kills_the_loop():
    """A raising pass is swallowed so the loop keeps ticking."""
    monitor = StubMonitor(RuntimeError("provider down"))
    scheduler = TargetAlertScheduler(monitor)

    assert scheduler.tick() is None
    assert scheduler.tick() is None
    assert monitor.passes == 2


class StubNotifications:
    """Record send_pending calls and optionally fail."""

    def __init__(self, error=None):
        """Store the optional failure each send must raise."""
        self.error = error
        self.calls = 0

    def send_pending(self):
        """Count the call and raise the configured failure first."""
        self.calls += 1
        if self.error is not None:
            raise self.error
        return 0


def test_tick_sends_pending_notifications_after_evaluation():
    """A tick drives email delivery once the evaluation pass completes."""
    monitor = StubMonitor()
    notifications = StubNotifications()

    TargetAlertScheduler(monitor, notifications=notifications).tick()

    assert monitor.passes == 1
    assert notifications.calls == 1


def test_a_failed_notification_does_not_break_the_loop():
    """A notification failure is swallowed just like an evaluation failure."""
    notifications = StubNotifications(OSError("smtp down"))
    scheduler = TargetAlertScheduler(StubMonitor(), notifications=notifications)

    assert scheduler.tick() is None
    assert scheduler.tick() is None
    assert notifications.calls == 2


def test_tick_without_notifications_keeps_working():
    """The notifier is optional so existing deployments need no SMTP config."""
    monitor = StubMonitor()

    assert TargetAlertScheduler(monitor).tick() is None
    assert monitor.passes == 1
