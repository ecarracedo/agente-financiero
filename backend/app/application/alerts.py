"""Application use cases for persistent portfolio and wishlist alerts."""

from collections.abc import Callable
from datetime import datetime, timezone
from decimal import Decimal

from backend.app.application.ports import (
    PortfolioUnitOfWorkFactory,
    PortfolioUnitOfWorkPort,
)
from backend.app.domain.alerts import (
    AlertIntent,
    AlertScope,
    ConfiguredAlert,
    TargetAlertEvent,
    TargetAlertSettings,
    TriggeredAlert,
    evaluate_target_alert,
)


def _alert_order(alert: ConfiguredAlert) -> tuple[int, str, str]:
    """Order alerts by scope, then ticker, then broker."""
    return (
        0 if alert.scope is AlertScope.PORTFOLIO else 1,
        alert.ticker,
        alert.broker or "",
    )


class TargetAlertUseCases:
    """Configure target intent and evaluate quote crossings transactionally."""

    def __init__(
        self,
        unit_of_work_factory: PortfolioUnitOfWorkFactory,
        *,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        """Initialize alert use cases with a caller-supplied unit of work."""
        self._unit_of_work_factory = unit_of_work_factory
        self._now = now or (lambda: datetime.now(timezone.utc))

    def configure_portfolio_alert(
        self,
        ticker: str,
        broker: str,
        category: str,
        target_price: Decimal,
        intent: AlertIntent,
    ) -> None:
        """Configure a target alert for an existing portfolio position."""
        settings = TargetAlertSettings(target_price, intent)
        with self._unit_of_work_factory() as unit_of_work:
            position = unit_of_work.portfolio.get_position(ticker, broker, category)
            if position is None:
                raise ValueError("position does not exist")
            unit_of_work.portfolio.set_position_alert(
                ticker, broker, category, settings
            )
            unit_of_work.commit()

    def evaluate_portfolio_alert(
        self,
        ticker: str,
        broker: str,
        category: str,
        current_price: Decimal,
    ) -> TargetAlertEvent | None:
        """Persist quote state and store a configured position crossing once."""
        with self._unit_of_work_factory() as unit_of_work:
            settings = unit_of_work.portfolio.get_position_alert(
                ticker, broker, category
            )
            if settings is None:
                return None
            stored = self._record_crossing(
                unit_of_work,
                AlertScope.PORTFOLIO,
                ticker,
                settings,
                current_price,
                broker=broker,
                category=category,
            )
            unit_of_work.commit()
        return None if stored is None else TargetAlertEvent(
            intent=stored.intent, message=stored.message
        )

    def configure_wishlist_alert(
        self, ticker: str, target_price: Decimal, intent: AlertIntent
    ) -> None:
        """Configure a target alert, adding the ticker to the wishlist when absent.

        An alert means "tell me when this asset reaches a price", so a ticker that is
        in neither the portfolio nor the wishlist is added to the wishlist first:
        otherwise nothing would ever evaluate it.
        """
        settings = TargetAlertSettings(target_price, intent)
        with self._unit_of_work_factory() as unit_of_work:
            if not unit_of_work.resources.set_wishlist_alert(ticker, settings):
                unit_of_work.resources.add_wishlist_item(ticker)
                if not unit_of_work.resources.set_wishlist_alert(ticker, settings):
                    raise RuntimeError(
                        "wishlist entry was added but its alert could not be set"
                    )
            unit_of_work.commit()

    def evaluate_wishlist_alert(
        self, ticker: str, current_price: Decimal
    ) -> TargetAlertEvent | None:
        """Persist quote state and store a configured wishlist crossing once."""
        with self._unit_of_work_factory() as unit_of_work:
            settings = unit_of_work.resources.get_wishlist_alert(ticker)
            if settings is None:
                return None
            stored = self._record_crossing(
                unit_of_work,
                AlertScope.WISHLIST,
                ticker,
                settings,
                current_price,
            )
            unit_of_work.commit()
        return None if stored is None else TargetAlertEvent(
            intent=stored.intent, message=stored.message
        )

    def evaluate_alert(
        self, ticker: str, current_price: Decimal
    ) -> tuple[TriggeredAlert, ...]:
        """Run one evaluation on a ticker and return the crossings it stored."""
        with self._unit_of_work_factory() as unit_of_work:
            alerts = tuple(
                alert
                for alert in (
                    *unit_of_work.portfolio.list_position_alerts(),
                    *unit_of_work.resources.list_wishlist_alerts(),
                )
                if alert.ticker == ticker
            )
            stored: list[TriggeredAlert] = []
            for alert in alerts:
                settings = self._settings_for(unit_of_work, alert)
                if settings is None:
                    continue
                crossing = self._record_crossing(
                    unit_of_work,
                    alert.scope,
                    alert.ticker,
                    settings,
                    current_price,
                    broker=alert.broker,
                    category=alert.category,
                    currency=alert.currency,
                )
                if crossing is not None:
                    stored.append(crossing)
            unit_of_work.commit()
        return tuple(stored)

    def list_events(
        self, *, include_acknowledged: bool = False
    ) -> tuple[TriggeredAlert, ...]:
        """Return triggered events newest first, hiding acknowledged ones by default."""
        with self._unit_of_work_factory() as unit_of_work:
            return unit_of_work.alert_events.list_events(
                include_acknowledged=include_acknowledged
            )

    def acknowledge_event(
        self, event_id: int, acknowledged_at: datetime | None = None
    ) -> bool:
        """Mark one event as seen; returns False when no such event exists."""
        with self._unit_of_work_factory() as unit_of_work:
            acknowledged = unit_of_work.alert_events.acknowledge_event(
                event_id, acknowledged_at or self._now()
            )
            unit_of_work.commit()
            return acknowledged

    def list_alerts(self) -> tuple[ConfiguredAlert, ...]:
        """List every configured alert, portfolio first and ticker A to Z."""
        with self._unit_of_work_factory() as unit_of_work:
            alerts = (
                *unit_of_work.portfolio.list_position_alerts(),
                *unit_of_work.resources.list_wishlist_alerts(),
            )
        return tuple(sorted(alerts, key=_alert_order))

    def delete_portfolio_alert(
        self, ticker: str, broker: str, category: str
    ) -> bool:
        """Remove a portfolio alert, keeping the position and its holdings."""
        with self._unit_of_work_factory() as unit_of_work:
            cleared = unit_of_work.portfolio.clear_position_alert(
                ticker, broker, category
            )
            unit_of_work.commit()
            return cleared

    def delete_wishlist_alert(self, ticker: str) -> bool:
        """Remove a wishlist alert, keeping the wishlist entry itself."""
        with self._unit_of_work_factory() as unit_of_work:
            cleared = unit_of_work.resources.clear_wishlist_alert(ticker)
            unit_of_work.commit()
            return cleared

    @staticmethod
    def _settings_for(
        unit_of_work: PortfolioUnitOfWorkPort, alert: ConfiguredAlert
    ) -> TargetAlertSettings | None:
        """Load the current crossing settings of an already-listed alert."""
        if alert.scope is AlertScope.WISHLIST:
            return unit_of_work.resources.get_wishlist_alert(alert.ticker)
        return unit_of_work.portfolio.get_position_alert(
            alert.ticker, alert.broker or "", alert.category or ""
        )

    def _record_crossing(
        self,
        unit_of_work: PortfolioUnitOfWorkPort,
        scope: AlertScope,
        ticker: str,
        settings: TargetAlertSettings,
        current_price: Decimal,
        *,
        broker: str | None = None,
        category: str | None = None,
        currency: str | None = None,
    ) -> TriggeredAlert | None:
        """Store the latest quote and persist a crossing when it happens.

        The previous observation is always refreshed, so a price that stays
        beyond the target raises exactly one event and not one per pass.
        """
        event = (
            evaluate_target_alert(
                settings.last_observed_price,
                current_price,
                settings.target_price,
                settings.intent,
            )
            if settings.last_observed_price is not None
            else None
        )
        if scope is AlertScope.WISHLIST:
            unit_of_work.resources.update_wishlist_alert_price(ticker, current_price)
        else:
            unit_of_work.portfolio.update_position_alert_price(
                ticker, broker or "", category or "", current_price
            )
            if currency is None and broker is not None and category is not None:
                position = unit_of_work.portfolio.get_position(
                    ticker, broker, category
                )
                currency = position.currency if position is not None else None
        if event is None:
            return None
        alert = ConfiguredAlert(
            scope=scope,
            ticker=ticker,
            target_price=settings.target_price,
            intent=settings.intent,
            broker=broker,
            category=category,
            currency=currency,
        )
        return unit_of_work.alert_events.record_event(
            alert, event, current_price, self._now()
        )
