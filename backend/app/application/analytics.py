"""Application use cases for portfolio valuation and market analysis."""

from decimal import Decimal

from backend.app.application.ports import MarketDataProviderPort, PortfolioReadRepositoryPort
from backend.app.domain.alerts import AlertIntent, TargetAlertEvent, evaluate_target_alert
from backend.app.domain.analysis import MarketAnalysis, analyze_market
from backend.app.domain.valuation import CurrencyValuation, value_portfolio


class PortfolioAnalyticsUseCases:
    """Coordinate portfolio reads with market data and pure domain analysis."""

    def __init__(
        self,
        position_repository: PortfolioReadRepositoryPort,
        market_data: MarketDataProviderPort,
    ) -> None:
        """Initialize analytics with read-only position and quote providers."""
        self._position_repository = position_repository
        self._market_data = market_data

    def value_portfolio(self) -> dict[str, CurrencyValuation]:
        """Value positions by currency without converting missing quotes to zero."""
        positions = self._position_repository.list_positions()
        current_prices = {
            ticker: price
            for ticker in {position.ticker for position in positions}
            if (price := self._market_data.get_current_price(ticker)) is not None
        }
        return value_portfolio(positions, current_prices)

    def get_current_price(self, ticker: str) -> Decimal | None:
        """Return the current provider quote for alert evaluation."""
        return self._market_data.get_current_price(ticker.strip().upper())

    def analyze_ticker(self, ticker: str, period: str = "1y") -> MarketAnalysis:
        """Combine one current quote and the dated provider series."""
        normalized_ticker = ticker.strip().upper()
        current_price = self._market_data.get_current_price(normalized_ticker)
        series = self._market_data.get_historical_series(normalized_ticker, period)
        return analyze_market(normalized_ticker, current_price, series)

    def evaluate_target_crossing(
        self,
        previous_price: Decimal,
        current_price: Decimal,
        target_price: Decimal,
        intent: AlertIntent,
    ) -> TargetAlertEvent | None:
        """Evaluate one quote transition against its configured target intent."""
        return evaluate_target_alert(
            previous_price, current_price, target_price, intent
        )
