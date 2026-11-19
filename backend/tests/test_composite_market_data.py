"""Tests for the composite provider's yfinance fallback without network calls."""

from datetime import date, datetime
from decimal import Decimal

from backend.app.adapters.composite_market_data import CompositeMarketDataProvider
from backend.app.domain.analysis import PricePoint, QuoteSnapshot
from backend.tests.test_market_data_adapter import FakeHistory


class StubPpiProvider:
    """Return nothing so the composite falls back to yfinance."""

    def get_quote(self, ticker):
        """Never quote anything."""
        return None

    def get_historical_series(self, ticker, period):
        """Never return a series."""
        return ()

    def search_symbols(self, query, limit=8):
        """Never match anything."""
        return ()


class FakeTicker:
    """Expose controlled price information and dated historical closes."""

    def __init__(self, info, closes=(), index=()):
        self.info = info
        self._history = FakeHistory(list(index), list(closes))

    def history(self, period):
        """Return dated close history for the requested period."""
        return self._history


def test_yfinance_fallback_divides_flagged_percent_of_par_quotes_by_100():
    """A user-flagged ON reported as EQUITY is still converted per 100 nominales."""
    provider = CompositeMarketDataProvider(
        ppi_provider=StubPpiProvider(),
        yfinance_factory=lambda ticker: FakeTicker(
            {"regularMarketPrice": 162230.0, "quoteType": "EQUITY", "currency": "ARS"}
        ),
        percent_of_par=lambda: {"YFCOO.BA"},
    )

    quote = provider.get_quote("YFCOO.BA")

    assert quote == QuoteSnapshot(price=Decimal("1622.3"), currency="ARS")


def test_yfinance_fallback_keeps_unflagged_quotes_raw():
    """An unlisted ticker without the flag keeps the provider price."""
    provider = CompositeMarketDataProvider(
        ppi_provider=StubPpiProvider(),
        yfinance_factory=lambda ticker: FakeTicker(
            {"regularMarketPrice": 4802.5, "quoteType": "EQUITY", "currency": "ARS"}
        ),
        percent_of_par=lambda: {"YFCOO.BA"},
    )

    quote = provider.get_quote("PAMP.BA")

    assert quote == QuoteSnapshot(price=Decimal("4802.5"), currency="ARS")


def test_yfinance_fallback_divides_flagged_historical_closes_by_100():
    """Flagged tickers get the same ÷100 conversion in the fallback history."""
    index = [datetime(2024, 1, 2), datetime(2024, 1, 3)]
    provider = CompositeMarketDataProvider(
        ppi_provider=StubPpiProvider(),
        yfinance_factory=lambda ticker: FakeTicker(
            {"quoteType": "EQUITY"}, [161930.0, 162230.0], index
        ),
        percent_of_par=lambda: {"YFCOO.BA"},
    )

    series = provider.get_historical_series("YFCOO.BA", "1mo")

    assert series == (
        PricePoint(date=date(2024, 1, 2), close=Decimal("1619.3")),
        PricePoint(date=date(2024, 1, 3), close=Decimal("1622.3")),
    )


def test_yfinance_fallback_divides_bond_quotes_by_100():
    """A BOND quote is a percentage of par; convert it to per-unit units."""
    provider = CompositeMarketDataProvider(
        ppi_provider=StubPpiProvider(),
        yfinance_factory=lambda ticker: FakeTicker(
            {"currentPrice": 96.38, "quoteType": "BOND", "currency": "USD"}
        ),
    )

    quote = provider.get_quote("YFC00.BA")

    assert quote == QuoteSnapshot(price=Decimal("0.9638"), currency="USD")


def test_yfinance_fallback_keeps_equity_quotes_raw():
    """An EQUITY quote is not a percentage of par; keep the raw price."""
    provider = CompositeMarketDataProvider(
        ppi_provider=StubPpiProvider(),
        yfinance_factory=lambda ticker: FakeTicker(
            {"currentPrice": 4802.5, "quoteType": "EQUITY", "currency": "ARS"}
        ),
    )

    quote = provider.get_quote("PAMP.BA")

    assert quote == QuoteSnapshot(price=Decimal("4802.5"), currency="ARS")


def test_yfinance_fallback_divides_bond_historical_closes_by_100():
    """BOND history closes are also quoted per 100 nominal units."""
    index = [datetime(2024, 1, 2), datetime(2024, 1, 3)]
    provider = CompositeMarketDataProvider(
        ppi_provider=StubPpiProvider(),
        yfinance_factory=lambda ticker: FakeTicker(
            {"quoteType": "BOND"}, [100.0, 105.0], index
        ),
    )

    series = provider.get_historical_series("YFC00.BA", "1mo")

    assert series == (
        PricePoint(date=date(2024, 1, 2), close=Decimal("1.0")),
        PricePoint(date=date(2024, 1, 3), close=Decimal("1.05")),
    )
