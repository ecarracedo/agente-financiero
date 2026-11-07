"""Tests for asset search: provider adapter, use case, and HTTP contract."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.app.adapters.market_data import YFinanceMarketDataProvider
from backend.app.adapters.persistence.models import Base
from backend.app.application.analytics import PortfolioAnalyticsUseCases
from backend.app.domain.tickers import TickerMatch
from backend.app.main import create_app


class FakeSearchResults:
    """Expose provider quotes the way ``yfinance.Search`` does."""

    def __init__(self, quotes):
        self.quotes = quotes


def provider_with_quotes(quotes, calls=None):
    """Build an adapter whose search returns controlled provider quotes."""

    def search_factory(query, limit):
        if calls is not None:
            calls.append((query, limit))
        return FakeSearchResults(quotes)

    return YFinanceMarketDataProvider(search_factory=search_factory)


def test_adapter_maps_provider_quotes_to_matches():
    """Provider labels are normalized into the domain match shape."""
    provider = provider_with_quotes(
        [
            {
                "symbol": "nvda",
                "longname": "NVIDIA Corporation",
                "exchDisp": "NASDAQ",
                "typeDisp": "Equity",
                "isYahooFinance": True,
            }
        ]
    )

    matches = provider.search_symbols("nvidia")

    assert matches == (
        TickerMatch(
            symbol="NVDA",
            name="NVIDIA Corporation",
            exchange="NASDAQ",
            quote_type="Equity",
        ),
    )


def test_adapter_skips_unusable_entries_and_duplicates():
    """Symbol-less, non-Yahoo, and repeated entries never reach the caller."""
    provider = provider_with_quotes(
        [
            {"symbol": "", "longname": "Missing symbol"},
            {"symbol": "MSFT", "shortname": "Microsoft", "isYahooFinance": False},
            {"symbol": "AAPL", "shortname": "Apple Inc."},
            {"symbol": "aapl", "shortname": "Apple Inc. duplicate"},
        ]
    )

    matches = provider.search_symbols("apple")

    assert [match.symbol for match in matches] == ["AAPL"]
    assert matches[0].name == "Apple Inc."
    assert matches[0].exchange == ""
    assert matches[0].quote_type == ""


def test_adapter_stops_at_the_requested_limit():
    """A provider list longer than the limit is truncated, not returned whole."""
    provider = provider_with_quotes(
        [{"symbol": f"SYM{index}", "shortname": f"Symbol {index}"} for index in range(5)]
    )

    matches = provider.search_symbols("symbol", limit=2)

    assert [match.symbol for match in matches] == ["SYM0", "SYM1"]


def test_adapter_returns_no_matches_when_the_provider_fails():
    """A provider exception yields an empty result instead of raising."""

    def failing_search(query, limit):
        raise RuntimeError("provider unavailable")

    provider = YFinanceMarketDataProvider(search_factory=failing_search)

    assert provider.search_symbols("nvidia") == ()


def test_use_case_does_not_query_the_provider_for_a_blank_query():
    """Whitespace alone is answered without touching the market provider."""
    calls = []
    provider = provider_with_quotes([], calls=calls)
    use_cases = PortfolioAnalyticsUseCases(_EmptyPortfolio(), provider)

    assert use_cases.search_symbols("   ") == ()
    assert calls == []


class _EmptyPortfolio:
    """Provide no positions for analytics use-case construction."""

    def list_positions(self):
        """Return an empty portfolio."""
        return []


class _StubMarketData:
    """Return a fixed match list for API contract tests."""

    def __init__(self):
        self.queries = []

    def get_quote(self, ticker):
        """Return no quote; search tests never ask for one."""
        return None

    def get_historical_series(self, ticker, period):
        """Return no series; search tests never ask for one."""
        return ()

    def search_symbols(self, query, limit=8):
        """Record the query and return one deterministic match."""
        self.queries.append((query, limit))
        return (
            TickerMatch(
                symbol="NVDA",
                name="NVIDIA Corporation",
                exchange="NASDAQ",
                quote_type="Equity",
            ),
        )


def api_client(market_data):
    """Build a client over an isolated database and the given provider."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return TestClient(
        create_app(
            database_engine=engine,
            market_data_provider=market_data,
            auth_enabled=False,
        )
    )


def test_api_returns_search_matches():
    """The endpoint exposes the provider matches with their labels."""
    market_data = _StubMarketData()

    response = api_client(market_data).get(
        "/api/v1/tickers/search", params={"q": "nvidia"}
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "symbol": "NVDA",
            "name": "NVIDIA Corporation",
            "exchange": "NASDAQ",
            "quote_type": "Equity",
        }
    ]
    assert market_data.queries == [("nvidia", 8)]


def test_api_honours_the_requested_limit():
    """The caller-supplied limit reaches the provider."""
    market_data = _StubMarketData()

    api_client(market_data).get(
        "/api/v1/tickers/search", params={"q": "nvidia", "limit": 3}
    )

    assert market_data.queries == [("nvidia", 3)]


def test_api_rejects_an_empty_query_and_an_out_of_range_limit():
    """A blank query and an oversized limit are refused as invalid input."""
    client = api_client(_StubMarketData())

    assert client.get("/api/v1/tickers/search", params={"q": ""}).status_code == 422
    assert (
        client.get("/api/v1/tickers/search", params={"q": "nvda", "limit": 26}).status_code
        == 422
    )
