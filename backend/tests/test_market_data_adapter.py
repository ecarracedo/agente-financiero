"""Tests for the yfinance market-data adapter without network calls."""

from datetime import date, datetime
from decimal import Decimal

from backend.app.adapters.market_data import YFinanceMarketDataProvider
from backend.app.domain.analysis import PricePoint, QuoteSnapshot


class FakeCloseSeries:
    """Provide a pandas-like indexed close series for adapter tests."""

    def __init__(self, index, values):
        self._index = list(index)
        self._values = list(values)

    def dropna(self):
        """Return dated closes with missing values removed."""
        pairs = [
            (stamp, value)
            for stamp, value in zip(self._index, self._values)
            if value is not None
        ]
        return FakeCloseSeries(
            [stamp for stamp, _ in pairs], [value for _, value in pairs]
        )

    def items(self):
        """Return (timestamp, value) pairs like a pandas Series."""
        return list(zip(self._index, self._values))


class FakeHistory:
    """Provide the close column expected from a yfinance history frame."""

    def __init__(self, index, closes):
        self._closes = FakeCloseSeries(index, closes)

    def __getitem__(self, column):
        """Return closes for the expected market-data column."""
        if column != "Close":
            raise KeyError(column)
        return self._closes


class FakeTicker:
    """Expose controlled price information and dated historical closes."""

    def __init__(self, info, closes, index=None):
        self.info = info
        self._closes = closes
        self._index = [] if index is None else index

    def history(self, period):
        """Return dated close history for the requested period."""
        return FakeHistory(self._index, self._closes)


def test_quote_carries_the_provider_currency():
    """The adapter reports the currency the instrument is quoted in."""
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker(
            {"currentPrice": 4802.5, "currency": "ARS"}, []
        )
    )

    quote = provider.get_quote("PAMP.BA")

    assert quote == QuoteSnapshot(price=Decimal("4802.5"), currency="ARS")


def test_quote_without_a_usable_currency_still_reports_the_price():
    """An unrecognizable currency field becomes unknown instead of a guess."""
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker(
            {"currentPrice": 12.34, "currency": "dólares"}, []
        )
    )

    quote = provider.get_quote("AAPL")

    assert quote == QuoteSnapshot(price=Decimal("12.34"), currency=None)


def test_current_price_uses_available_provider_field():
    """The adapter converts a current quote to Decimal without binary floats."""
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker(
            {"currentPrice": 12.34, "previousClose": 11.0}, []
        )
    )

    assert provider.get_quote("AAPL") == QuoteSnapshot(Decimal("12.34"), None)


def test_current_price_falls_back_to_previous_close():
    """The adapter uses previous close when live fields are absent."""
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker({"previousClose": 9.75}, [])
    )

    assert provider.get_quote("AAPL") == QuoteSnapshot(Decimal("9.75"), None)


def test_historical_series_pairs_dates_with_decimal_closes():
    """Dated closes become PricePoints in provider (chronological) order."""
    index = [datetime(2024, 1, 2), datetime(2024, 1, 3), datetime(2024, 1, 4)]
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker({}, [10.1, 12.25, 9.5], index)
    )

    series = provider.get_historical_series("AAPL", "1mo")

    assert series == (
        PricePoint(date=date(2024, 1, 2), close=Decimal("10.1")),
        PricePoint(date=date(2024, 1, 3), close=Decimal("12.25")),
        PricePoint(date=date(2024, 1, 4), close=Decimal("9.5")),
    )


def test_historical_series_skips_missing_closes():
    """Missing provider closes drop out so the series has no invented points."""
    index = [datetime(2024, 1, 2), datetime(2024, 1, 3), datetime(2024, 1, 4)]
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker({}, [10.1, None, 12.25], index)
    )

    series = provider.get_historical_series("AAPL", "1mo")

    assert series == (
        PricePoint(date=date(2024, 1, 2), close=Decimal("10.1")),
        PricePoint(date=date(2024, 1, 4), close=Decimal("12.25")),
    )


def test_historical_series_skips_non_positive_closes():
    """Non-positive closes are not valid market prices and are dropped."""
    index = [datetime(2024, 1, 2), datetime(2024, 1, 3)]
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker({}, [11.0, -3.0], index)
    )

    series = provider.get_historical_series("AAPL", "1mo")

    assert series == (PricePoint(date=date(2024, 1, 2), close=Decimal("11.0")),)


def test_provider_failure_returns_unavailable_data():
    """Provider exceptions produce unknown data instead of invented prices."""

    def failing_ticker_factory(ticker):
        raise RuntimeError("market provider unavailable")

    provider = YFinanceMarketDataProvider(ticker_factory=failing_ticker_factory)

    assert provider.get_quote("AAPL") is None
    assert provider.get_historical_series("AAPL", "1y") == ()


def test_historical_series_skips_entries_with_unparseable_dates():
    """Entries whose index is not a date are dropped; valid ones survive."""
    provider = YFinanceMarketDataProvider(
        ticker_factory=lambda ticker: FakeTicker(
            {},
            [10.0, 11.0, 12.0],
            index=["not-a-date", datetime(2024, 1, 3, 9, 30), None],
        )
    )

    assert provider.get_historical_series("AAPL", "1y") == (
        PricePoint(date=date(2024, 1, 3), close=Decimal("11.0")),
    )
