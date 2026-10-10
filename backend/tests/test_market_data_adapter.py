"""Tests for the yfinance market-data adapter without network calls."""

from decimal import Decimal

from backend.app.adapters.market_data import YFinanceMarketDataProvider


class FakeCloseSeries:
    """Provide a pandas-like close series for deterministic adapter tests."""

    def __init__(self, values):
        self._values = values

    def dropna(self):
        """Return a series with missing values removed."""
        return FakeCloseSeries([value for value in self._values if value is not None])

    def tolist(self):
        """Return the configured close values."""
        return list(self._values)


class FakeHistory:
    """Provide the close column expected from a yfinance history frame."""

    def __init__(self, closes):
        self._closes = FakeCloseSeries(closes)

    def __getitem__(self, column):
        """Return closes for the expected market-data column."""
        if column != "Close":
            raise KeyError(column)
        return self._closes


class FakeTicker:
    """Expose controlled price information and historical closes."""

    def __init__(self, info, closes):
        self.info = info
        self._closes = closes

    def history(self, period):
        """Return close history for the requested period."""
        return FakeHistory(self._closes)


def test_current_price_uses_available_provider_field():
    """The adapter converts a current quote to Decimal without binary floats."""
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker(
            {"currentPrice": 12.34, "previousClose": 11.0}, []
        )
    )

    assert provider.get_current_price("AAPL") == Decimal("12.34")


def test_current_price_falls_back_to_previous_close():
    """The adapter uses previous close when live fields are absent."""
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker({"previousClose": 9.75}, [])
    )

    assert provider.get_current_price("AAPL") == Decimal("9.75")


def test_historical_prices_are_decimal_and_skip_missing_values():
    """Historical close values are converted to Decimal and missing points drop."""
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker({}, [10.1, None, 12.25])
    )

    assert provider.get_historical_closes("AAPL", "1y") == [
        Decimal("10.1"),
        Decimal("12.25"),
    ]


def test_provider_failure_returns_unavailable_data():
    """Provider exceptions produce unknown data instead of invented prices."""
    def failing_ticker_factory(ticker):
        raise RuntimeError("market provider unavailable")

    provider = YFinanceMarketDataProvider(ticker_factory=failing_ticker_factory)

    assert provider.get_current_price("AAPL") is None
    assert provider.get_historical_closes("AAPL", "1y") == []
