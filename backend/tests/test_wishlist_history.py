"""HTTP contract tests for the wishlist price-history endpoint."""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.app.adapters.persistence.models import Base
from backend.app.domain.analysis import PricePoint
from backend.app.main import create_app


def point(year, month, day, close):
    """Build one dated close for the fake provider."""
    return PricePoint(date=date(year, month, day), close=Decimal(close))


class FakeMarketDataProvider:
    """Provide deterministic dated series and record requested periods."""

    def __init__(self):
        self.series = {}
        self.requested = []

    def get_quote(self, ticker):
        """Return no quote; history tests never need one."""
        return None

    def get_historical_series(self, ticker, period):
        """Return the configured series and record the call."""
        self.requested.append((ticker, period))
        return tuple(self.series.get(ticker, ()))


@pytest.fixture
def history_client():
    """Provide a client over an isolated database and a fake provider."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    market_data = FakeMarketDataProvider()
    application = create_app(
        database_engine=engine,
        market_data_provider=market_data,
        auth_enabled=False,
        snapshot_scheduler_enabled=False,
        alert_scheduler_enabled=False,
    )
    with TestClient(application) as client:
        yield client, market_data
    engine.dispose()


def test_history_returns_chronological_points_and_variations(history_client):
    """Points keep their order and S5 formulas drive both percentages."""
    client, market_data = history_client
    client.post("/api/v1/wishlist", json={"ticker": "aapl"})
    market_data.series["AAPL"] = [
        point(2024, 1, 2, "100"),
        point(2024, 1, 30, "110"),
        point(2024, 2, 15, "120"),
        point(2024, 2, 28, "132"),
    ]

    response = client.get("/api/v1/wishlist/aapl/history?period=3mo")

    assert response.status_code == 200
    assert response.json() == {
        "ticker": "AAPL",
        "period": "3mo",
        "points": [
            {"date": "2024-01-02", "close": "100", "high": None, "low": None},
            {"date": "2024-01-30", "close": "110", "high": None, "low": None},
            {"date": "2024-02-15", "close": "120", "high": None, "low": None},
            {"date": "2024-02-28", "close": "132", "high": None, "low": None},
        ],
        "monthly_variation_percent": "20",
        "period_variation_percent": "32",
    }
    assert market_data.requested == [("AAPL", "3mo")]


def test_history_serializes_high_and_low_as_canonical_money(history_client):
    """Provider extremes reach the API as canonical strings, not raw floats."""
    client, market_data = history_client
    client.post("/api/v1/wishlist", json={"ticker": "AAPL"})
    market_data.series["AAPL"] = [
        PricePoint(
            date=date(2024, 2, 1),
            close=Decimal("10"),
            high=Decimal("10.5"),
            low=Decimal("9.25"),
        )
    ]

    response = client.get("/api/v1/wishlist/AAPL/history?period=3mo")

    assert response.status_code == 200
    assert response.json()["points"] == [
        {"date": "2024-02-01", "close": "10", "high": "10.5", "low": "9.25"}
    ]


def test_history_variations_are_null_with_too_little_data(history_client):
    """One month yields no monthly variation; one point yields neither."""
    client, market_data = history_client
    client.post("/api/v1/wishlist", json={"ticker": "AAPL"})
    market_data.series["AAPL"] = [point(2024, 2, 1, "10"), point(2024, 2, 20, "12")]

    one_month = client.get("/api/v1/wishlist/AAPL/history?period=6mo").json()
    market_data.series["AAPL"] = [point(2024, 2, 1, "10")]
    one_point = client.get("/api/v1/wishlist/AAPL/history?period=1y").json()
    market_data.series["AAPL"] = []
    empty = client.get("/api/v1/wishlist/AAPL/history?period=1y").json()

    assert one_month["monthly_variation_percent"] is None
    assert one_month["period_variation_percent"] == "20"
    assert one_point["period_variation_percent"] is None
    assert one_point["monthly_variation_percent"] is None
    assert empty["points"] == []


def test_history_rejects_unknown_ticker_and_bad_period(history_client):
    """A ticker outside the wishlist is 404 and never reaches the provider."""
    client, market_data = history_client
    client.post("/api/v1/wishlist", json={"ticker": "AAPL"})

    missing = client.get("/api/v1/wishlist/MSFT/history?period=3mo")
    bad_period = client.get("/api/v1/wishlist/AAPL/history?period=5y")

    assert missing.status_code == 404
    assert missing.json() == {"detail": "wishlist item not found"}
    assert bad_period.status_code == 422
    assert market_data.requested == []


def test_existing_wishlist_crud_is_unchanged(history_client):
    """Create, retarget, duplicate and delete keep their status codes."""
    client, _ = history_client

    created = client.post("/api/v1/wishlist", json={"ticker": " aapl "})
    duplicate = client.post("/api/v1/wishlist", json={"ticker": "AAPL"})
    target = client.put("/api/v1/wishlist/AAPL/target", json={"target_price": "150"})
    listed = client.get("/api/v1/wishlist").json()
    removed = client.delete("/api/v1/wishlist/AAPL")
    missing = client.delete("/api/v1/wishlist/AAPL")

    assert created.status_code == 201
    assert duplicate.status_code == 409
    assert target.status_code == 200
    assert listed == [
        {"ticker": "AAPL", "target_price": "150", "alert_intent": "BUY", "currency": None}
    ]
    assert removed.status_code == 200
    assert missing.status_code == 404


def test_wishlist_target_endpoint_configures_and_clears_an_alert(history_client):
    """A target saved in the wishlist appears in configured alerts until cleared."""
    client, _ = history_client
    client.post("/api/v1/wishlist", json={"ticker": "AAPL"})

    assert client.put("/api/v1/wishlist/AAPL/target", json={"target_price": "150"}).status_code == 200
    alerts = client.get("/api/v1/alerts").json()
    assert [
        (alert["scope"], alert["ticker"], alert["intent"])
        for alert in alerts
        if alert["ticker"] == "AAPL"
    ] == [("wishlist", "AAPL", "BUY")]

    assert client.put("/api/v1/wishlist/AAPL/target", json={"target_price": None}).status_code == 200
    assert [
        alert for alert in client.get("/api/v1/alerts").json() if alert["ticker"] == "AAPL"
    ] == []
