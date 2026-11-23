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



class FakeClock:
    """Manually advanced clock for deterministic cache expiry."""

    def __init__(self):
        self.now = 0.0

    def __call__(self):
        """Return the current fake time in seconds."""
        return self.now


class CountingFactory:
    """Count factory calls and history calls while serving a shared ticker."""

    def __init__(self, ticker):
        self.ticker = ticker
        self.calls = 0

    def __call__(self, symbol):
        """Return the shared fake ticker and record the call."""
        self.calls += 1
        return self.ticker


class CountingTicker(FakeTicker):
    """Fake ticker that counts history lookups."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.history_calls = 0

    def history(self, period):
        """Count and return the history."""
        self.history_calls += 1
        return super().history(period)


def _cached_provider(factory, clock):
    return CompositeMarketDataProvider(
        ppi_provider=StubPpiProvider(),
        yfinance_factory=factory,
        cache_ttl_seconds=900,
        clock=clock,
    )


def test_repeated_quotes_hit_yfinance_once_within_ttl_and_refresh_after():
    """Quotes are cached for one TTL window and refreshed once it elapses."""
    clock = FakeClock()
    factory = CountingFactory(FakeTicker({"regularMarketPrice": 10.0, "currency": "USD"}))
    provider = _cached_provider(factory, clock)

    first = provider.get_quote("AAPL")
    clock.now = 899
    second = provider.get_quote("aapl")
    assert first == second == QuoteSnapshot(price=Decimal("10.0"), currency="USD")
    assert factory.calls == 1

    clock.now = 900
    provider.get_quote("AAPL")
    assert factory.calls == 2


def test_failed_quotes_are_not_cached():
    """A failing lookup is retried on the next call."""
    clock = FakeClock()

    def failing(symbol):
        failing.calls += 1
        raise RuntimeError("boom")

    failing.calls = 0
    provider = _cached_provider(failing, clock)

    assert provider.get_quote("AAPL") is None
    assert provider.get_quote("AAPL") is None
    assert failing.calls == 2


def test_repeated_history_calls_history_once_per_ticker_and_period():
    """History is cached per (ticker, period) and reuses cached info."""
    clock = FakeClock()
    ticker = CountingTicker(
        {"quoteType": "BOND"}, [96.0], [datetime(2024, 1, 2)]
    )
    factory = CountingFactory(ticker)
    provider = _cached_provider(factory, clock)

    first = provider.get_historical_series("AL30", "1mo")
    second = provider.get_historical_series("AL30", "1mo")
    assert first == second == (PricePoint(date=date(2024, 1, 2), close=Decimal("0.96")),)
    assert ticker.history_calls == 1

    provider.get_historical_series("AL30", "3mo")
    assert ticker.history_calls == 2

    clock.now = 900
    provider.get_historical_series("AL30", "1mo")
    assert ticker.history_calls == 3


def test_history_reuses_cached_info_from_quote():
    """Per-100 detection uses the cached info instead of a second lookup."""
    clock = FakeClock()
    info_reads = []

    class InfoTicker(CountingTicker):
        @property
        def info(self):
            info_reads.append(1)
            return {"regularMarketPrice": 96.0, "quoteType": "BOND"}

        @info.setter
        def info(self, value):
            pass

    ticker = InfoTicker({}, [96.0], [datetime(2024, 1, 2)])
    provider = _cached_provider(CountingFactory(ticker), clock)

    provider.get_quote("AL30")
    series = provider.get_historical_series("AL30", "1mo")

    assert len(info_reads) == 1
    assert series[0].close == Decimal("0.96")


def test_failed_history_is_not_cached():
    """An empty or failing history is retried on the next call."""
    clock = FakeClock()
    ticker = CountingTicker({"quoteType": "EQUITY"}, [], [])
    provider = _cached_provider(CountingFactory(ticker), clock)

    assert provider.get_historical_series("AAPL", "1mo") == ()
    assert provider.get_historical_series("AAPL", "1mo") == ()
    assert ticker.history_calls == 2
