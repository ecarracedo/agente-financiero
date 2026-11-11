"""Tests for the daily portfolio snapshot scheduler."""

import logging

from backend.app.application.snapshot_scheduler import PortfolioSnapshotScheduler


class StubSnapshotUseCases:
    """Record scheduler calls instead of touching a database or the network."""

    def __init__(self, *, snapshots=None, due=True, range_error=None, today_error=None, recovered=None, recover_error=None):
        self._snapshots = list(snapshots or [])
        self._due = due
        self._range_error = range_error
        self._today_error = today_error
        self._recovered = list(recovered or [])
        self._recover_error = recover_error
        self.range_calls = []
        self.today_calls = 0
        self.recover_calls = 0

    def list_snapshots(self):
        """Return the configured snapshot rows."""
        return list(self._snapshots)

    def create_estimated_range(self, days_back=30):
        """Record the backfill request, or raise the configured error."""
        if self._range_error is not None:
            raise self._range_error
        self.range_calls.append(days_back)
        return []

    def is_snapshot_due(self, *, now=None):
        """Return the configured due flag."""
        return self._due

    def backfill_missing_days(self, days_back=7):
        """Record the recovery pass, or raise the configured error."""
        self.recover_calls += 1
        if self._recover_error is not None:
            raise self._recover_error
        return list(self._recovered)

    def create_today_snapshot(self):
        """Record the daily snapshot request, or raise the configured error."""
        if self._today_error is not None:
            raise self._today_error
        self.today_calls += 1
        return {"date": "2026-11-11", "value": 0, "cumulative_return": "0"}


def test_tick_backfills_an_empty_history():
    """An empty table is filled with the estimated range, not left blank."""
    use_cases = StubSnapshotUseCases(snapshots=[])

    PortfolioSnapshotScheduler(use_cases).tick()

    assert use_cases.range_calls == [30]
    assert use_cases.today_calls == 0


def test_tick_waits_while_the_snapshot_is_not_due():
    """When today is already saved or the hour has not arrived, nothing is written."""
    use_cases = StubSnapshotUseCases(snapshots=[object()], due=False)

    PortfolioSnapshotScheduler(use_cases).tick()

    assert use_cases.range_calls == []
    assert use_cases.today_calls == 0


def test_tick_writes_todays_snapshot_when_due():
    """The daily tick persists exactly one snapshot for the day."""
    use_cases = StubSnapshotUseCases(snapshots=[object()], due=True)

    PortfolioSnapshotScheduler(use_cases).tick()

    assert use_cases.today_calls == 1
    assert use_cases.range_calls == []


def test_tick_does_not_raise_when_there_are_no_transactions(caplog):
    """A portfolio without transactions is logged, never fatal."""
    use_cases = StubSnapshotUseCases(
        snapshots=[], range_error=ValueError("no transactions to snapshot")
    )

    with caplog.at_level(logging.WARNING):
        PortfolioSnapshotScheduler(use_cases).tick()

    assert use_cases.today_calls == 0
    assert "no transactions to snapshot" in caplog.text


def test_tick_recovers_missing_days_before_writing_today():
    """The recovery pass runs on a non-empty history and later days still land."""
    use_cases = StubSnapshotUseCases(
        snapshots=[object()],
        due=True,
        recovered=[{"date": "2026-11-09"}, {"date": "2026-11-10"}],
    )

    PortfolioSnapshotScheduler(use_cases).tick()

    assert use_cases.recover_calls == 1
    assert use_cases.today_calls == 1


def test_tick_still_writes_today_when_recovery_fails(caplog):
    """A failed recovery must not swallow the daily snapshot."""
    use_cases = StubSnapshotUseCases(
        snapshots=[object()],
        due=True,
        recover_error=ValueError("provider unavailable"),
    )

    with caplog.at_level(logging.WARNING):
        PortfolioSnapshotScheduler(use_cases).tick()

    assert use_cases.today_calls == 1
    assert "provider unavailable" in caplog.text


def test_tick_does_not_recover_when_the_history_is_empty():
    """The initial backfill already covers the window; no double work."""
    use_cases = StubSnapshotUseCases(snapshots=[])

    PortfolioSnapshotScheduler(use_cases).tick()

    assert use_cases.range_calls == [30]
    assert use_cases.recover_calls == 0
