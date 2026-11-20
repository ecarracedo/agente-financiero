"""Application use case that delivers unsent alert crossings by email.

The use case is the boundary between persistence and the notification
adapter: it asks the unit of work for crossings that have not been emailed,
sends each one, and marks only the successful sends. A failed send stays in
the pending set, so the next scheduler tick retries it automatically. Nothing
here knows about SMTP; that detail lives in the injected notifier.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timezone

from backend.app.application.ports import (
    PortfolioUnitOfWorkFactory,
    PortfolioUnitOfWorkPort,
)

_LOGGER = logging.getLogger(__name__)


class AlertNotificationUseCases:
    """Send every crossing that has not been delivered as email yet."""

    def __init__(
        self,
        unit_of_work_factory: PortfolioUnitOfWorkFactory,
        notifier,
        *,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        """Initialize with a unit-of-work factory and a notifier adapter."""
        self._unit_of_work_factory = unit_of_work_factory
        self._notifier = notifier
        self._now = now or (lambda: datetime.now(timezone.utc))

    def send_pending(self) -> int:
        """Email all unnotified crossings and return how many were sent.

        Each send is isolated: a notifier failure is logged and the crossing is
        left unmarked for a later retry, while the remaining crossings are
        still attempted. A send is marked only after the notifier succeeds.
        """
        with self._unit_of_work_factory() as unit_of_work:
            pending = unit_of_work.alert_events.list_unemailed_events()

        sent = 0
        for event in pending:
            try:
                self._notifier.send(event)
            except Exception as error:  # noqa: BLE001 - isolate each delivery
                _LOGGER.warning(
                    "alert email for event %s skipped: %s", event.id, error
                )
                continue
            self._mark_sent(event.id, unit_of_work_factory=self._unit_of_work_factory)
            sent += 1
        return sent

    def _mark_sent(
        self, event_id: int, *, unit_of_work_factory: PortfolioUnitOfWorkFactory
    ) -> None:
        """Persist the emailed timestamp for one successfully delivered event."""
        with unit_of_work_factory() as unit_of_work:
            unit_of_work.alert_events.mark_emailed(event_id, self._now())
            unit_of_work.commit()
