"""HTTP contract tests for the financial-agent API."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.app.adapters.persistence.models import Base
from backend.app.domain.analysis import PricePoint
from backend.app.main import create_app


def points(closes):
    """Build a chronological dated series for API contract tests."""
    return [
        PricePoint(date=date(2024, 1, 1) + timedelta(days=index), close=close)
        for index, close in enumerate(closes)
    ]


class FakeMarketDataProvider:
    """Provide deterministic quotes and dated series for API tests."""

    def __init__(self):
        self.prices = {}
        self.price_sequences = {}
        self.series = {}
        self.requested_periods = []

    def get_current_price(self, ticker):
        """Return the next configured quote or a stable quote."""
        sequence = self.price_sequences.get(ticker)
        if sequence:
            return sequence.pop(0)
        return self.prices.get(ticker)

    def get_historical_series(self, ticker, period):
        """Return configured dated points and record the requested period."""
        self.requested_periods.append(period)
        return tuple(self.series.get(ticker, []))


@pytest.fixture
def api_client():
    """Provide a FastAPI client backed by an isolated SQLAlchemy database."""
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
    )
    with TestClient(application) as client:
        yield client, market_data
    engine.dispose()


def operation(ticker, operation_type, quantity, price, day):
    """Build a valid transaction request payload."""
    return {
        "ticker": ticker,
        "broker": "Broker A",
        "category": "Acciones",
        "operation_type": operation_type,
        "quantity": str(quantity),
        "unit_price": str(price),
        "currency": "USD",
        "occurred_at": f"2024-01-{day:02d}T00:00:00",
    }


def test_transaction_endpoints_record_history_and_reject_oversale(api_client):
    """Transaction routes preserve business behavior and reject invalid sales."""
    client, _ = api_client

    purchase = client.post(
        "/api/v1/transactions", json=operation("AAPL", "BUY", 2, 10, 1)
    )
    sale = client.post(
        "/api/v1/transactions", json=operation("AAPL", "SELL", 1, 15, 2)
    )
    rejected = client.post(
        "/api/v1/transactions", json=operation("AAPL", "SELL", 5, 9, 3)
    )
    history = client.get(
        "/api/v1/transactions", params={"ticker": "AAPL", "broker": "Broker A"}
    )

    assert purchase.status_code == 201
    assert purchase.json()["quantity"] == "2"
    assert purchase.json()["currency"] == "USD"
    assert sale.status_code == 201
    assert sale.json()["quantity"] == "1"
    assert sale.json()["average_price"] == "10"
    assert rejected.status_code == 422
    assert len(history.json()) == 2
    assert history.json()[1]["unit_price"] == "15"


def test_delete_transaction_endpoint_rebuilds_position(api_client):
    """Deleting a sale replays remaining history and restores the holding."""
    client, _ = api_client
    client.post("/api/v1/transactions", json=operation("AAPL", "BUY", 2, 10, 1))
    client.post("/api/v1/transactions", json=operation("AAPL", "BUY", 2, 20, 2))
    client.post("/api/v1/transactions", json=operation("AAPL", "SELL", 1, 15, 3))
    history = client.get(
        "/api/v1/transactions", params={"ticker": "AAPL", "broker": "Broker A"}
    ).json()

    response = client.delete(f"/api/v1/transactions/{history[-1]['id']}")
    portfolio = client.get("/api/v1/portfolio").json()

    assert response.status_code == 200
    assert response.json() == {"deleted": True}
    assert portfolio[0]["quantity"] == "4"
    assert portfolio[0]["average_price"] == "15"


def test_valuation_and_analysis_endpoints_preserve_currency(api_client):
    """Valuation and analysis routes return currency-grouped Decimal data."""
    client, market_data = api_client
    market_data.prices["AAPL"] = Decimal("15")
    market_data.series["AAPL"] = points(
        [Decimal("10")] * 199 + [Decimal("20")]
    )
    client.post("/api/v1/transactions", json=operation("AAPL", "BUY", 2, 10, 1))

    valuations = client.get("/api/v1/valuations")
    analysis = client.get("/api/v1/analysis/AAPL", params={"period": "1y"})

    assert valuations.status_code == 200
    assert valuations.json()["USD"]["market_value"] == "30"
    assert analysis.status_code == 200
    assert analysis.json()["high_52_week"] == "20"
    assert "ABOVE_200_DAY_AVERAGE" in analysis.json()["signals"]


def test_analysis_endpoint_exposes_a_chronological_canonical_series(api_client):
    """The analysis response carries dated closes as canonical money strings."""
    client, market_data = api_client
    market_data.prices["AAPL"] = Decimal("20")
    market_data.series["AAPL"] = points(
        [Decimal("10"), Decimal("11.5"), Decimal("20")]
    )

    response = client.get("/api/v1/analysis/AAPL", params={"period": "3mo"})

    assert response.status_code == 200
    assert response.json()["series"] == [
        {"date": "2024-01-01", "close": "10"},
        {"date": "2024-01-02", "close": "11.5"},
        {"date": "2024-01-03", "close": "20"},
    ]
    assert market_data.requested_periods == ["3mo"]


def test_analysis_endpoint_returns_empty_series_for_unknown_ticker(api_client):
    """An unavailable ticker keeps its unknown status and carries no series."""
    client, _ = api_client

    response = client.get("/api/v1/analysis/ZZZZ", params={"period": "6mo"})

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "UNKNOWN"
    assert body["reason"] == "No current market price"
    assert body["series"] == []


def test_analysis_endpoint_returns_no_series_without_history(api_client):
    """A current quote without history stays unknown with an empty series."""
    client, market_data = api_client
    market_data.prices["AAPL"] = Decimal("20")

    body = client.get("/api/v1/analysis/AAPL").json()

    assert body["status"] == "UNKNOWN"
    assert body["reason"] == "No historical data"
    assert body["current_price"] == "20"
    assert body["series"] == []


def test_target_alert_endpoints_configure_and_emit_once(api_client):
    """Alert routes persist intent and suppress repeated crossings."""
    client, market_data = api_client
    client.post("/api/v1/transactions", json=operation("AAPL", "BUY", 2, 10, 1))
    market_data.price_sequences["AAPL"] = [Decimal("11"), Decimal("10"), Decimal("9")]

    configured = client.put(
        "/api/v1/portfolio/AAPL/alert",
        json={
            "broker": "Broker A",
            "category": "Acciones",
            "target_price": "10",
            "intent": "BUY",
        },
    )
    first = client.post(
        "/api/v1/portfolio/AAPL/alert/check",
        json={"broker": "Broker A", "category": "Acciones"},
    )
    crossed = client.post(
        "/api/v1/portfolio/AAPL/alert/check",
        json={"broker": "Broker A", "category": "Acciones"},
    )
    repeated = client.post(
        "/api/v1/portfolio/AAPL/alert/check",
        json={"broker": "Broker A", "category": "Acciones"},
    )

    assert configured.status_code == 200
    assert first.json()["event"] is None
    assert crossed.json()["event"]["intent"] == "BUY"
    assert crossed.json()["event"]["message"] == "Precio objetivo de compra alcanzado."
    assert repeated.json()["event"] is None


def test_wishlist_alert_endpoint_adds_a_missing_wishlist_entry(api_client):
    """Configuring an alert for a ticker outside the wishlist adds it, then configures it."""
    client, _ = api_client

    response = client.put(
        "/api/v1/wishlist/NVDA/alert",
        json={"target_price": "500", "intent": "BUY"},
    )
    wishlist = client.get("/api/v1/wishlist").json()

    assert response.status_code == 200
    assert response.json() == {"configured": True}
    assert [item["ticker"] for item in wishlist] == ["NVDA"]
    assert wishlist[0]["target_price"] == "500"


def test_resource_and_split_endpoints_are_exposed_in_openapi(api_client):
    """Resource CRUD and split routes appear in OpenAPI and execute successfully."""
    client, _ = api_client

    wishlist = client.post("/api/v1/wishlist", json={"ticker": " aapl "})
    bibliography = client.post(
        "/api/v1/bibliography",
        json={"title": "Market Structure", "author": "A. Author"},
    )
    split = client.post(
        "/api/v1/splits",
        json={
            "quantity": "100",
            "average_price": "10",
            "new_shares": 2,
            "old_shares": 1,
        },
    )
    routes = client.get("/openapi.json").json()["paths"]

    assert wishlist.status_code == 201
    assert wishlist.json()["ticker"] == "AAPL"
    assert bibliography.status_code == 201
    assert bibliography.json()["title"] == "Market Structure"
    assert split.status_code == 200
    assert split.json()["quantity"] == "200"
    assert "/api/v1/transactions" in routes
    assert "/api/v1/portfolio/{ticker}/alert" in routes
    assert "/api/v1/valuations" in routes
    assert "/api/v1/splits" in routes


def test_analysis_endpoint_rejects_an_invalid_ticker(api_client):
    """A blank or over-long analysis ticker is a client error, not a server error."""
    client, _ = api_client

    blank = client.get("/api/v1/analysis/%20")
    over_long = client.get(f"/api/v1/analysis/{'A' * 33}")

    assert blank.status_code == 422
    assert over_long.status_code == 422


def test_wishlist_write_endpoints_reject_an_invalid_ticker(api_client):
    """No wishlist path may create a row for a blank or over-long ticker."""
    client, _ = api_client
    alert = {"target_price": "10", "intent": "BUY"}

    blank_create = client.post("/api/v1/wishlist", json={"ticker": "   "})
    blank_alert = client.put("/api/v1/wishlist/%20/alert", json=alert)
    over_long_alert = client.put(f"/api/v1/wishlist/{'A' * 33}/alert", json=alert)

    assert blank_create.status_code == 422
    assert blank_alert.status_code == 422
    assert over_long_alert.status_code == 422
    assert client.get("/api/v1/wishlist").json() == []


def test_wishlist_item_endpoints_reject_an_invalid_ticker(api_client):
    """Target and removal endpoints validate before reporting a missing item."""
    client, _ = api_client

    blank_target = client.put(
        "/api/v1/wishlist/%20/target", json={"target_price": "10"}
    )
    over_long_target = client.put(
        f"/api/v1/wishlist/{'A' * 33}/target", json={"target_price": "10"}
    )
    blank_delete = client.delete("/api/v1/wishlist/%20")

    assert blank_target.status_code == 422
    assert over_long_target.status_code == 422
    assert blank_delete.status_code == 422


def test_alert_check_endpoints_reject_an_invalid_ticker(api_client):
    """An invalid ticker is a client error, never an unavailable market price."""
    client, _ = api_client

    portfolio = client.post(
        "/api/v1/portfolio/%20/alert/check",
        json={"broker": "Broker A", "category": "Acciones"},
    )
    wishlist = client.post("/api/v1/wishlist/%20/alert/check")

    assert portfolio.status_code == 422
    assert wishlist.status_code == 422
    assert portfolio.json()["detail"] != "market price unavailable"
    assert wishlist.json()["detail"] != "market price unavailable"


def test_transaction_ticker_inputs_share_the_canonical_rule(api_client):
    """Body and query tickers report the same canonical rejection."""
    client, _ = api_client

    blank_body = client.post(
        "/api/v1/transactions", json=operation("   ", "BUY", 1, 10, 1)
    )
    blank_query = client.get(
        "/api/v1/transactions", params={"ticker": "   ", "broker": "Broker A"}
    )

    assert blank_body.status_code == 422
    assert blank_body.json()["detail"] == "ticker is required"
    assert blank_query.status_code == 422
    assert blank_query.json()["detail"] == "ticker is required"
    assert client.get("/api/v1/portfolio").json() == []


def test_valid_path_and_query_tickers_reach_the_domain_normalized(api_client):
    """A valid ticker keeps working and is normalized before use."""
    client, market_data = api_client
    market_data.prices["AAPL"] = Decimal("15")
    market_data.series["AAPL"] = points([Decimal("10"), Decimal("15")])
    client.post("/api/v1/transactions", json=operation("AAPL", "BUY", 2, 10, 1))

    analysis = client.get("/api/v1/analysis/aapl")
    history = client.get(
        "/api/v1/transactions", params={"ticker": " aapl ", "broker": "Broker A"}
    )

    assert analysis.status_code == 200
    assert analysis.json()["ticker"] == "AAPL"
    assert history.status_code == 200
    assert len(history.json()) == 1


def test_padded_tickers_beyond_the_raw_bound_are_rejected(api_client):
    """Padding cannot slip a symbol past the declared contract bound.

    The contract bound measures the raw string, so a symbol whose normalized
    form fits inside the column is still a client error when its unpadded
    length exceeds the bound, and nothing is persisted.
    """
    client, _ = api_client
    alert = {"target_price": "10", "intent": "BUY"}
    padded_path = "%20%20%20%20" + "A" * 30 + "%20%20%20%20"
    padded_query = " " * 4 + "A" * 30 + " " * 4

    path_write = client.put(f"/api/v1/wishlist/{padded_path}/alert", json=alert)
    path_read = client.get(f"/api/v1/analysis/{padded_path}")
    query_read = client.get(
        "/api/v1/transactions", params={"ticker": padded_query, "broker": "Broker A"}
    )

    assert path_write.status_code == 422
    assert path_read.status_code == 422
    assert query_read.status_code == 422
    assert client.get("/api/v1/wishlist").json() == []
