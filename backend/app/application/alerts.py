"""Application use cases for persistent portfolio and wishlist alerts."""

from decimal import Decimal

from backend.app.application.ports import PortfolioUnitOfWorkFactory
from backend.app.domain.alerts import (
    AlertIntent,
    TargetAlertEvent,
    TargetAlertSettings,
    evaluate_target_alert,
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
        """Configure a target alert for an existing wishlist item."""
        settings = TargetAlertSettings(target_price, intent)
        with self._unit_of_work_factory() as unit_of_work:
            if not unit_of_work.resources.set_wishlist_alert(ticker, settings):
                raise ValueError("wishlist item does not exist")
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
