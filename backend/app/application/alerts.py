"""Application use cases for persistent portfolio and wishlist alerts."""

from decimal import Decimal

from backend.app.application.ports import PortfolioUnitOfWorkFactory
from backend.app.domain.alerts import (
    AlertIntent,
    AlertScope,
    ConfiguredAlert,
    TargetAlertEvent,
    TargetAlertSettings,
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

    def __init__(self, unit_of_work_factory: PortfolioUnitOfWorkFactory) -> None:
        """Initialize alert use cases with a caller-supplied unit of work."""
        self._unit_of_work_factory = unit_of_work_factory

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
        """Persist quote state and emit a configured position crossing once."""
        with self._unit_of_work_factory() as unit_of_work:
            repository = unit_of_work.portfolio
            settings = repository.get_position_alert(ticker, broker, category)
            if settings is None:
                return None
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
            repository.update_position_alert_price(
                ticker, broker, category, current_price
            )
            unit_of_work.commit()
            return event

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
        """Persist quote state and emit a configured wishlist crossing once."""
        with self._unit_of_work_factory() as unit_of_work:
            repository = unit_of_work.resources
            settings = repository.get_wishlist_alert(ticker)
            if settings is None:
                return None
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
            repository.update_wishlist_alert_price(ticker, current_price)
            unit_of_work.commit()
            return event

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
