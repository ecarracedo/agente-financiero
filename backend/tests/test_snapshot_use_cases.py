"""Tests for portfolio daily snapshot use cases (ARS estimate)."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

from backend.app.application.snapshots import PortfolioSnapshotUseCases


def _tx(ticker, day_offset, qty, op="BUY", tx_id=1, currency="ARS"):

    return SimpleNamespace(
        id=tx_id,
        ticker=ticker,
        broker="Broker A",
        category="Acciones",
        operation_type=op,
        quantity=Decimal(qty),
        unit_price=Decimal("100"),
        currency=currency,
        occurred_at=datetime(2024, 1, 1) + timedelta(days=day_offset),
    )


def _pos(ticker, qty, currency="ARS"):
    return SimpleNamespace(
        ticker=ticker,
        broker="Broker A",
        category="Acciones",
        quantity=Decimal(qty),
        average_price=Decimal("100"),
        currency=currency,
    )


class FakePositionRepository:
    def __init__(self, transactions=None, positions=None):
        self._transactions = list(transactions or [])
        self._positions = list(positions or [])
        self._snapshots = {}
        self._settings = {}

    def list_all_transactions(self):
        return list(self._transactions)

    def list_positions(self):
        return list(self._positions)

    def save_snapshot(self, *, date, total_value):
        self._snapshots[date.date()] = SimpleNamespace(date=date, total_value=total_value)

    def list_snapshots(self):
        return [self._snapshots[d] for d in sorted(self._snapshots)]

    def get_setting(self, key):
        return self._settings.get(key)

    def set_setting(self, *, key, value):
        self._settings[key] = value


class FakeMarketDataProvider:
    def __init__(self, quotes=None):
        self._quotes = dict(quotes or {})
        self.quote_requests = []

    def get_quote(self, ticker):
        self.quote_requests.append(ticker)
        q = self._quotes.get(ticker)
        if q is None:
            return None
        return SimpleNamespace(price=q["price"], currency=q.get("currency", "ARS"))


class FakeUnitOfWorkFactory:
    def __init__(self, repo, market_data):
        self._repo = repo
        self._market_data = market_data

    def __call__(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def commit(self):
        pass

    @property
    def portfolio(self):
        return self._repo

    @property
    def snapshots(self):
        return self._repo

    @property
    def settings(self):
        return self._repo


def test_create_estimated_range_uses_current_prices_in_ars():
    """All positions valued at current price, converted to ARS."""
    repo = FakePositionRepository(
        transactions=[_tx("AAPL", 0, "10")],
        positions=[_pos("AAPL", "10", "USD")],
    )
    # USD quote at 1000 ARS per USD; AAPL trades at $110 USD.
    provider = FakeMarketDataProvider(
        {
            "AAPL": {"price": "110", "currency": "USD"},
            "GD30": {"price": "1000", "currency": "ARS"},
            "GD30D": {"price": "1", "currency": "USD"},
        }
    )
    use_cases = PortfolioSnapshotUseCases(
        FakeUnitOfWorkFactory(repo, provider), provider
    )

    result = use_cases.create_estimated_range(days_back=3)

    assert len(result) == 3
    # 10 shares * $110 * 1000 ARS/USD = 1,100,000 ARS every day (no buys/sells after day 0).
    for entry in result:
        assert entry["value"] == Decimal("1100000")


def test_create_estimated_range_converts_usd_to_ars():
    """USD positions are multiplied by the CCL rate."""
    repo = FakePositionRepository(
        transactions=[_tx("RUCDD", 0, "100", currency="USD")],
        positions=[_pos("RUCDD", "100", "USD")],
    )
    provider = FakeMarketDataProvider(
        {
            "RUCDD": {"price": "10", "currency": "USD"},
            "GD30": {"price": "1000", "currency": "ARS"},
            "GD30D": {"price": "1", "currency": "USD"},
        }
    )
    use_cases = PortfolioSnapshotUseCases(
        FakeUnitOfWorkFactory(repo, provider), provider
    )

    result = use_cases.create_estimated_range(days_back=1)

    assert len(result) == 1
    # 100 * $10 * 1000 ARS/USD = 1,000,000 ARS
    assert result[0]["value"] == Decimal("1000000")


def test_list_snapshots_computes_cumulative_return():
    repo = FakePositionRepository([])
    repo._snapshots = {
        date(2024, 1, 1): SimpleNamespace(date=datetime(2024, 1, 1), total_value=Decimal("1000")),
        date(2024, 1, 2): SimpleNamespace(date=datetime(2024, 1, 2), total_value=Decimal("1100")),
    }
    provider = FakeMarketDataProvider({})
    use_cases = PortfolioSnapshotUseCases(
        FakeUnitOfWorkFactory(repo, provider), provider
    )

    result = use_cases.list_snapshots()

    assert len(result) == 2
    assert result[0]["cumulative_return"] == "0"
    assert result[1]["cumulative_return"] == "0.1"


def test_get_and_set_snapshot_schedule():
    repo = FakePositionRepository([])
    provider = FakeMarketDataProvider({})
    use_cases = PortfolioSnapshotUseCases(
        FakeUnitOfWorkFactory(repo, provider), provider
    )

    assert use_cases.get_snapshot_hour() == 17
    assert use_cases.get_snapshot_timezone() == "America/Argentina/Buenos_Aires"

    use_cases.set_snapshot_schedule(hour=9, timezone="America/New_York")

    assert use_cases.get_snapshot_hour() == 9
    assert use_cases.get_snapshot_timezone() == "America/New_York"
