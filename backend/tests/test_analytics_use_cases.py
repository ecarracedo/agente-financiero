"""Tests for valuation, market-analysis, and target-alert use cases."""

from datetime import date, timedelta
from decimal import Decimal

from backend.app.application.analytics import PortfolioAnalyticsUseCases
from backend.app.domain.alerts import AlertIntent
from backend.app.domain.analysis import PricePoint
from backend.app.domain.portfolio import PortfolioPosition


def points(closes):
    """Build a chronological dated series for market-analysis use-case tests."""
    return [
        PricePoint(date=date(2024, 1, 1) + timedelta(days=index), close=close)
        for index, close in enumerate(closes)
    ]


class FakePositionRepository:
    """Provide deterministic portfolio positions for analytics tests."""

    def __init__(self, positions):
        self._positions = positions

    def list_positions(self):
        """Return the configured positions."""
        return list(self._positions)


class FakeMarketDataProvider:
    """Provide deterministic current prices and dated historical series."""

    def __init__(self, prices, histories):
        self._prices = prices
        self._histories = histories
        self.history_requests = []

    def get_current_price(self, ticker):
        """Return a configured current quote or None."""
        return self._prices.get(ticker)

    def get_historical_series(self, ticker, period):
        """Return configured dated points and record the requested period."""
        self.history_requests.append((ticker, period))
        return tuple(self._histories.get(ticker, []))


def test_valuation_use_case_groups_positions_by_currency():
    """The application valuation use case never combines unlike currencies."""
    positions = [
        PortfolioPosition("AAPL", "Broker A", "Acciones", Decimal("2"), Decimal("10"), "USD"),
        PortfolioPosition("GGAL", "Broker A", "Acciones", Decimal("2"), Decimal("1000"), "ARS"),
    ]
    use_cases = PortfolioAnalyticsUseCases(
        FakePositionRepository(positions),
        FakeMarketDataProvider(
            {"AAPL": Decimal("12"), "GGAL": Decimal("900")}, {}
        ),
    )

    totals = use_cases.value_portfolio()

    assert totals["USD"].market_value == Decimal("24")
    assert totals["ARS"].market_value == Decimal("1800")


def test_valuation_use_case_preserves_unavailable_quotes():
    """Missing provider quotes remain unknown instead of being converted to zero."""
    position = PortfolioPosition(
        "AAPL", "Broker A", "Acciones", Decimal("2"), Decimal("10"), "USD"
    )
    use_cases = PortfolioAnalyticsUseCases(
        FakePositionRepository([position]), FakeMarketDataProvider({}, {})
    )

    total = use_cases.value_portfolio()["USD"]

    assert total.invested_value == Decimal("20")
    assert total.market_value is None
    assert total.unpriced_tickers == ("AAPL",)


def test_market_analysis_use_case_uses_provider_series():
    """The analysis use case combines the current quote with the dated series."""
    series = points([Decimal("10")] * 199 + [Decimal("20")])
    use_cases = PortfolioAnalyticsUseCases(
        FakePositionRepository([]),
        FakeMarketDataProvider({"AAPL": Decimal("20")}, {"AAPL": series}),
    )

    result = use_cases.analyze_ticker("aapl")

    assert result.ticker == "AAPL"
    assert result.moving_average_200 == Decimal("10.05")
    assert "ABOVE_200_DAY_AVERAGE" in result.signals
    assert result.series == tuple(series)


def test_market_analysis_forwards_the_requested_period_to_the_provider():
    """The use case passes the requested period through to the market-data port."""
    provider = FakeMarketDataProvider(
        {"AAPL": Decimal("20")},
        {"AAPL": points([Decimal("10"), Decimal("11"), Decimal("12")])},
    )
    use_cases = PortfolioAnalyticsUseCases(FakePositionRepository([]), provider)

    use_cases.analyze_ticker("AAPL", "5y")

    assert provider.history_requests == [("AAPL", "5y")]


def test_market_analysis_is_unknown_when_current_quote_is_unavailable():
    """Historical data without a current quote does not invent a price signal."""
    use_cases = PortfolioAnalyticsUseCases(
        FakePositionRepository([]),
        FakeMarketDataProvider({}, {"AAPL": points([Decimal("10")] * 200)}),
    )

    result = use_cases.analyze_ticker("AAPL")

    assert result.status == "UNKNOWN"
    assert result.reason == "No current market price"
    assert result.current_price is None
    assert result.signals == ()
    assert result.series == ()


def test_alert_use_case_emits_configured_intent_event():
    """The application boundary preserves the selected target-alert intent."""
    use_cases = PortfolioAnalyticsUseCases(
        FakePositionRepository([]), FakeMarketDataProvider({}, {})
    )

    event = use_cases.evaluate_target_crossing(
        Decimal("9"), Decimal("10"), Decimal("10"), AlertIntent.SELL
    )

    assert event is not None
    assert event.intent is AlertIntent.SELL
    assert event.message == "Precio objetivo de venta alcanzado."
