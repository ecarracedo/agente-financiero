"""Evaluate every configured target alert against its current market quote.

The monitor is the piece the scheduler and the on-demand endpoint share: it
resolves the alerts, requests exactly one quote per ticker, and delegates the
crossing decision to the alert use cases. A provider failure is contained to
the ticker that caused it, so one unreachable symbol never blocks the rest.
"""

import logging

from backend.app.application.alerts import TargetAlertUseCases
from backend.app.application.ports import MarketDataProviderPort
from backend.app.domain.alerts import TriggeredAlert

_LOGGER = logging.getLogger(__name__)


class AlertMonitorUseCases:
    """Run one evaluation pass over every configured alert."""

    def __init__(
        self,
        alerts: TargetAlertUseCases,
        market_data: MarketDataProviderPort,
    ) -> None:
        """Initialize the monitor with the alert use cases it drives."""
        self._alerts = alerts
        self._market_data = market_data

    def evaluate_all(self) -> tuple[TriggeredAlert, ...]:
        """Quote every monitored ticker once and return the stored crossings."""
        try:
            alerts = self._alerts.list_alerts()
        except Exception as error:  # noqa: BLE001 - a pass must never kill the loop
            _LOGGER.warning("target alert pass skipped: %s", error)
            return ()

        recorded: list[TriggeredAlert] = []
        for ticker in sorted({alert.ticker for alert in alerts}):
            try:
                quote = self._market_data.get_quote(ticker)
            except Exception as error:  # noqa: BLE001 - isolate the failing ticker
                _LOGGER.warning("quote for %s skipped: %s", ticker, error)
                continue
            if quote is None or quote.price is None:
                continue
            try:
                recorded.extend(self._alerts.evaluate_alert(ticker, quote.price))
            except Exception as error:  # noqa: BLE001 - isolate the failing ticker
                _LOGGER.warning("alert evaluation for %s skipped: %s", ticker, error)
        return tuple(recorded)
