"""End-to-end wiring of the daily snapshot scheduler into the FastAPI app."""

from datetime import datetime
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.app.adapters.persistence.models import (
    Base,
    PortfolioDailySnapshotRecord,
)
from backend.app.main import create_app


class StubMarketData:
    """Return fixed quotes so valuation never touches the network."""

    def __init__(self):
        self.quotes = {
            "AAPL": ("110", "USD"),
            "GD30": ("1000", "ARS"),
            "GD30D": ("1", "USD"),
        }

    def get_quote(self, ticker):
        """Return the configured quote, or None when unknown."""
        quote = self.quotes.get(ticker)
        if quote is None:
            return None
        return SimpleNamespace(price=quote[0], currency=quote[1])

    def get_historical_series(self, ticker, period):
        """Return an empty series; snapshots do not need history."""
        return ()


def _operation(ticker, quantity, price, day):
    """Build a valid transaction payload."""
    return {
        "ticker": ticker,
        "broker": "Broker A",
        "category": "Acciones",
        "operation_type": "BUY",
        "quantity": str(quantity),
        "unit_price": str(price),
        "currency": "USD",
        "occurred_at": f"2024-01-{day:02d}T00:00:00",
    }


def test_scheduler_tick_fills_the_api_snapshot_endpoint():
    """The scheduler writes through the app's own database and use cases."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    application = create_app(
        database_engine=engine,
        market_data_provider=StubMarketData(),
        auth_enabled=False,
    )
    client = TestClient(application)

    created = client.post("/api/v1/transactions", json=_operation("AAPL", 10, 100, 1))
    assert created.status_code == 201
    assert client.get("/api/v1/portfolio/snapshots").json() == []

    application.state.snapshot_scheduler.tick()

    snapshots = client.get("/api/v1/portfolio/snapshots").json()
    assert len(snapshots) == 30
    # 10 shares * $110 * 1000 ARS/USD = 1,100,000 ARS.
    assert snapshots[-1]["value"] == "1100000"
    engine.dispose()


def test_scheduler_recovers_a_day_that_was_lost():
    """A deleted recent day is rewritten by the next tick, other days untouched."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    application = create_app(
        database_engine=engine,
        market_data_provider=StubMarketData(),
        auth_enabled=False,
    )
    client = TestClient(application)
    client.post("/api/v1/transactions", json=_operation("AAPL", 10, 100, 1))
    application.state.snapshot_scheduler.tick()
    before = client.get("/api/v1/portfolio/snapshots").json()
    lost = before[-3]["date"]

    with engine.begin() as connection:
        connection.execute(
            PortfolioDailySnapshotRecord.__table__.delete().where(
                PortfolioDailySnapshotRecord.date == datetime.fromisoformat(lost)
            )
        )
    assert len(client.get("/api/v1/portfolio/snapshots").json()) == 29

    application.state.snapshot_scheduler.tick()

    after = client.get("/api/v1/portfolio/snapshots").json()
    assert [snapshot["date"] for snapshot in after] == [
        snapshot["date"] for snapshot in before
    ]
    engine.dispose()
