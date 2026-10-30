"""Application use cases for portfolio valuation and market analysis."""

from decimal import Decimal

from backend.app.application.ports import MarketDataProviderPort, PortfolioReadRepositoryPort
from backend.app.domain.alerts import AlertIntent, TargetAlertEvent, evaluate_target_alert
from backend.app.domain.analysis import MarketAnalysis, analyze_market
from backend.app.domain.tickers import (
    DEFAULT_SEARCH_RESULTS,
    TickerMatch,
    normalize_ticker,
)
from backend.app.domain.valuation import CurrencyValuation, value_portfolio

# The period the analysis uses whenever a caller does not ask for one. The use
# cases and the agent tools read it from here so they cannot drift apart. The
# HTTP API declares its own default beside the pattern that validates it.
DEFAULT_ANALYSIS_PERIOD: str = "1y"


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
        return self._market_data.get_current_price(normalize_ticker(ticker))

    def search_symbols(
        self, query: str, limit: int = DEFAULT_SEARCH_RESULTS
    ) -> tuple[TickerMatch, ...]:
        """Return provider symbol matches for a free-text asset search.

        A blank query is answered with no matches instead of a provider call, so
        an empty input can never surface an arbitrary instrument list.
        """
        trimmed = query.strip()
        if not trimmed:
            return ()
        return tuple(self._market_data.search_symbols(trimmed, limit))

    def analyze_ticker(
        self, ticker: str, period: str = DEFAULT_ANALYSIS_PERIOD
    ) -> MarketAnalysis:
        """Combine one current quote and the dated provider series."""
        normalized_ticker = normalize_ticker(ticker)
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
