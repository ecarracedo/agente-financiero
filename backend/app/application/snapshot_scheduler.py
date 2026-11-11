"""Background scheduler that writes the daily portfolio value snapshot.

The snapshot history is only useful when a row exists for every day, so the
process itself has to write it. The scheduler polls instead of sleeping until
the next run: a change to ``snapshot_hour``/``snapshot_timezone`` through the
settings API, a server clock shift, or a process that was down at the
configured hour all take effect without restarting the API.

Polling hourly is enough: the snapshot is daily, and the poll only decides
whether it is time. Every tick also repairs the gaps of the recent window, so a
day lost while the process was down (or while the market data provider was
failing) still gets recovered on the next tick.
"""

import asyncio
import logging
from datetime import datetime
from typing import Callable

from backend.app.application.snapshots import (
    DEFAULT_CATCH_UP_DAYS,
    DEFAULT_ESTIMATED_DAYS,
    PortfolioSnapshotUseCases,
)

_LOGGER = logging.getLogger(__name__)

DEFAULT_POLL_INTERVAL_SECONDS: float = 3600.0


class PortfolioSnapshotScheduler:
    """Write one portfolio snapshot per day, at the configured hour."""

    def __init__(
        self,
        use_cases: PortfolioSnapshotUseCases,
        *,
        interval_seconds: float = DEFAULT_POLL_INTERVAL_SECONDS,
        now: Callable[[], datetime | None] | None = None,
    ) -> None:
        """Initialize the scheduler with the snapshot use cases it feeds."""
        self._use_cases = use_cases
        self._interval_seconds = interval_seconds
        self._now = now or (lambda: None)
        self._last_error: str | None = None

    async def run(self) -> None:
        """Poll forever, writing the daily snapshot whenever it is due."""
        while True:
            await asyncio.to_thread(self.tick)
            await asyncio.sleep(self._interval_seconds)

    def tick(self) -> None:
        """Backfill an empty history, then recover gaps and write today when due."""
        try:
            if not self._use_cases.list_snapshots():
                created = self._use_cases.create_estimated_range(
                    days_back=DEFAULT_ESTIMATED_DAYS
                )
                self._last_error = None
                _LOGGER.info(
                    "portfolio snapshot history backfilled (%s days)", len(created)
                )
                return

            self._recover_missing_days()
            if not self._use_cases.is_snapshot_due(now=self._now()):
                return

            snapshot = self._use_cases.create_today_snapshot()
            self._last_error = None
            _LOGGER.info("portfolio snapshot written for %s", snapshot["date"])
        except Exception as error:  # noqa: BLE001 - a failed tick must never kill the loop
            self._report(error)

    def _recover_missing_days(self) -> None:
        """Write the missing days of the window without blocking today's row."""
        try:
            recovered = self._use_cases.backfill_missing_days(
                days_back=DEFAULT_CATCH_UP_DAYS
            )
        except Exception as error:  # noqa: BLE001 - recovery must not stop the daily write
            self._report(error)
            return

        if recovered:
            _LOGGER.info(
                "portfolio snapshot recovered %s missing days", len(recovered)
            )

    def _report(self, error: Exception) -> None:
        """Log a failure once, keeping the loop alive on repeated identical errors."""
        message = str(error)
        if message != self._last_error:
            _LOGGER.warning("daily portfolio snapshot skipped: %s", message)
            self._last_error = message
