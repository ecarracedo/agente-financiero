"""Tests for portfolio daily snapshot use cases."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

from backend.app.application.snapshots import PortfolioSnapshotUseCases
from backend.app.domain.analysis import PricePoint


def _tx(ticker, day_offset, qty, op="BUY", tx_id=1):

    return SimpleNamespace(
        id=tx_id,
        ticker=ticker,
        broker="Broker A",
        category="Acciones",
        operation_type=op,
        quantity=Decimal(qty),
        unit_price=Decimal("100"),
        currency="USD",
        occurred_at=datetime(2024, 1, 1) + timedelta(days=day_offset),
    )


def _series(closes):
    return [
        SimpleNamespace(date=date(2024, 1, 1) + timedelta(days=i), close=Decimal(c))
        for i, c in enumerate(closes)
    ]


class FakePositionRepository:
    def __init__(self, transactions=None):
        self._transactions = list(transactions or [])
        self._snapshots = {}
        self._settings = {}

    def list_all_transactions(self):
        return list(self._transactions)

    def save_snapshot(self, *, date, total_value):
        self._snapshots[date.date()] = SimpleNamespace(date=date, total_value=total_value)

    def list_snapshots(self):
        return [self._snapshots[d] for d in sorted(self._snapshots)]

    def get_setting(self, key):
        return self._settings.get(key)

    def set_setting(self, *, key, value):
        self._settings[key] = value


class FakeMarketDataProvider:
    def __init__(self, histories):
        self._histories = histories
        self.history_requests = []

    def get_historical_series(self, ticker, period):
        self.history_requests.append((ticker, period))
        return tuple(self._histories.get(ticker, []))


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


def test_create_daily_snapshot_persists_value():
    repo = FakePositionRepository(
        [_tx("AAPL", 0, "10"), _tx("AAPL", 5, "5", op="BUY", tx_id=2)]
    )
    provider = FakeMarketDataProvider(
        {"AAPL": _series(["100", "101", "102", "103", "104", "105", "110"])}
    )
    use_cases = PortfolioSnapshotUseCases(
        FakeUnitOfWorkFactory(repo, provider), provider
    )

    result = use_cases.create_daily_snapshot("1mo", target_date=date(2024, 1, 7))

    assert result["date"] == "2024-01-07"
    assert result["value"] == Decimal("1650")  # 15 * 110


def test_create_daily_snapshot_replaces_existing_date():
    repo = FakePositionRepository([_tx("AAPL", 0, "10")])
    provider = FakeMarketDataProvider({"AAPL": _series(["100", "110"])})
    use_cases = PortfolioSnapshotUseCases(
        FakeUnitOfWorkFactory(repo, provider), provider
    )

    result = use_cases.create_daily_snapshot("1mo", target_date=date(2024, 1, 1))
    result = use_cases.create_daily_snapshot("1mo", target_date=date(2024, 1, 1))

    snapshots = use_cases.list_snapshots()
    assert len(snapshots) == 1  # idempotent: same date replaced, not duplicated
    assert result["value"] == Decimal("1000")  # 10 * 100 for 2024-01-01


def test_list_snapshots_computes_cumulative_return():
    repo = FakePositionRepository([_tx("AAPL", 0, "10")])
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
    assert result[0]["cumulative_return"] == Decimal("0")
    assert result[1]["cumulative_return"] == Decimal("0.1")


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
