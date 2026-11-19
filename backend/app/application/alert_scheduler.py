"""Background scheduler that evaluates every configured target alert.

The app is a single-user deployment with no external notification channel, so
the scheduler runs inside the API process and the crossings wait for the user
in the alerts workspace. It polls on a fixed interval instead of sleeping until
a target is reached: the interval is what bounds how late a crossing is seen.
"""

import asyncio
import logging

from backend.app.application.alert_monitor import AlertMonitorUseCases

_LOGGER = logging.getLogger(__name__)

DEFAULT_POLL_INTERVAL_SECONDS: float = 300.0


class TargetAlertScheduler:
    """Evaluate every configured alert on a fixed poll interval."""

    def __init__(
        self,
        monitor: AlertMonitorUseCases,
        *,
        interval_seconds: float = DEFAULT_POLL_INTERVAL_SECONDS,
    ) -> None:
        """Initialize the scheduler with the monitor it drives."""
        self._monitor = monitor
        self._interval_seconds = interval_seconds
        self._last_error: str | None = None

    async def run(self) -> None:
        """Poll forever, evaluating every configured alert on each pass."""
        while True:
            await asyncio.to_thread(self.tick)
            await asyncio.sleep(self._interval_seconds)

    def tick(self) -> None:
        """Run one evaluation pass, swallowing failures to keep the loop alive."""
        try:
            events = self._monitor.evaluate_all()
        except Exception as error:  # noqa: BLE001 - a failed pass must never kill the loop
            self._report(error)
            return
        self._last_error = None
        if events:
            _LOGGER.info("target alerts fired: %s", len(events))

    def _report(self, error: Exception) -> None:
        """Log a failure once, keeping the loop alive on repeated identical errors."""
        message = str(error)
        if message != self._last_error:
            _LOGGER.warning("target alert evaluation skipped: %s", message)
            self._last_error = message
