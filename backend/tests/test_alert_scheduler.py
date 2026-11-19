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
