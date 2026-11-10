"""Use cases for daily portfolio value snapshots."""

from collections import defaultdict
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from backend.app.application.ports import (
    AppSettingRepositoryPort,
    MarketDataProviderPort,
    PortfolioSnapshotRecord,
    PortfolioSnapshotRepositoryPort,
    PortfolioUnitOfWorkFactory,
    TransactionRecordPort,
)
from backend.app.domain.analysis import PricePoint

DEFAULT_SNAPSHOT_HOUR: int = 17  # 17 hs Argentina (UTC-3)
DEFAULT_SNAPSHOT_TIMEZONE: str = "America/Argentina/Buenos_Aires"

_SETTING_SNAPSHOT_HOUR = "snapshot_hour"
_SETTING_SNAPSHOT_TIMEZONE = "snapshot_timezone"


class PortfolioSnapshotUseCases:
    """Create and read daily portfolio value snapshots."""

    def __init__(
        self,
        unit_of_work_factory: PortfolioUnitOfWorkFactory,
        market_data: MarketDataProviderPort,
    ) -> None:
        """Initialize snapshot use cases with UoW and market data providers."""
        self._unit_of_work_factory = unit_of_work_factory
        self._market_data = market_data

    def get_snapshot_hour(self) -> int:
        """Return the configured snapshot hour (default 17, Argentina UTC-3)."""
        with self._unit_of_work_factory() as unit_of_work:
            value = unit_of_work.settings.get_setting(_SETTING_SNAPSHOT_HOUR)
        if value is None:
            return DEFAULT_SNAPSHOT_HOUR
        try:
            return int(value)
        except ValueError:
            return DEFAULT_SNAPSHOT_HOUR

    def get_snapshot_timezone(self) -> str:
        """Return the configured snapshot timezone (default America/Argentina/Buenos_Aires)."""
        with self._unit_of_work_factory() as unit_of_work:
            value = unit_of_work.settings.get_setting(_SETTING_SNAPSHOT_TIMEZONE)
        return value if value is not None else DEFAULT_SNAPSHOT_TIMEZONE

    def set_snapshot_schedule(self, *, hour: int, timezone: str) -> None:
        """Persist the snapshot hour and timezone."""
        with self._unit_of_work_factory() as unit_of_work:
            unit_of_work.settings.set_setting(key=_SETTING_SNAPSHOT_HOUR, value=str(hour))
            unit_of_work.settings.set_setting(key=_SETTING_SNAPSHOT_TIMEZONE, value=timezone)
            unit_of_work.commit()

    def create_daily_snapshot(
        self, period: str = "1mo", target_date: date | None = None
    ) -> dict:
        """Reconstruct the portfolio value for a given day and persist a snapshot.

        Reads all transactions and the historical closing price series for each
        ticker, computes the net quantity held per ticker as of the target date,
        values the portfolio at that day's close, and stores one row for that
        date (replacing any existing row for that date).

        When ``target_date`` is omitted, the current date in the configured
        snapshot timezone is used.
        """
        if target_date is None:
            target_date = self._today_in_tz().date()

        # Read all transactions inside the unit of work and detach them into
        # plain dicts so the session can close before we touch the records.
        with self._unit_of_work_factory() as unit_of_work:
            records = unit_of_work.portfolio.list_all_transactions()
            txs: list[dict] = [
                {
                    "ticker": r.ticker,
                    "broker": r.broker,
                    "category": r.category,
                    "operation_type": r.operation_type,
                    "quantity": r.quantity,
                    "unit_price": r.unit_price,
                    "currency": r.currency,
                    "occurred_at": r.occurred_at,
                    "id": r.id,
                }
                for r in records
            ]

        if not txs:
            raise ValueError("no transactions to snapshot")

        # Group transactions by ticker
        tx_by_ticker: dict[str, list[dict]] = defaultdict(list)
        for tx in txs:
            tx_by_ticker[tx["ticker"]].append(tx)

        tickers = sorted(tx_by_ticker.keys())

        # Fetch historical series for each ticker in parallel
        series_by_ticker: dict[str, list[PricePoint]] = {}
        with ThreadPoolExecutor(max_workers=min(len(tickers), 8)) as pool:
            future_to_ticker = {
                pool.submit(self._market_data.get_historical_series, ticker, period): ticker
                for ticker in tickers
            }
            for future in as_completed(future_to_ticker):
                ticker = future_to_ticker[future]
                try:
                    series = future.result()
                except Exception:
                    series = ()
                if series:
                    series_by_ticker[ticker] = sorted(series, key=lambda p: p.date)

        if not series_by_ticker:
            raise ValueError("no historical prices available for snapshot")

        # Net quantity per ticker as of target_date
        cumulative_by_ticker: dict[str, list[tuple[date, Decimal]]] = {}
        for ticker, tx_list in tx_by_ticker.items():
            sorted_txs = sorted(
                tx_list, key=lambda t: (t["occurred_at"].date(), t["id"])
            )
            cum_qty = Decimal("0")
            cum_list: list[tuple[date, Decimal]] = []
            for tx in sorted_txs:
                tx_date = tx["occurred_at"].date()
                if tx["operation_type"] == "BUY":
                    cum_qty += tx["quantity"]
                elif tx["operation_type"] == "SELL":
                    cum_qty -= tx["quantity"]
                cum_list.append((tx_date, cum_qty))
            cumulative_by_ticker[ticker] = cum_list

        def _as_date(value) -> date:
            """Coerce a datetime/Timestamp/date into a plain date for comparison."""
            if hasattr(value, "date"):
                return value.date()
            return value  # type: ignore[return-value]

        def qty_as_of(ticker: str, target: date) -> Decimal:
            cum_list = cumulative_by_ticker.get(ticker, [])
            qty = Decimal("0")
            for tx_date, cum_qty in cum_list:
                if _as_date(tx_date) <= target:
                    qty = cum_qty
                else:
                    break
            return qty

        def price_as_of(ticker: str, target: date) -> Decimal | None:
            series = series_by_ticker.get(ticker, [])
            price: Decimal | None = None
            target_as_date = target
            for point in series:
                if _as_date(point.date) <= target_as_date:
                    price = point.close
                else:
                    break
            return price

        daily_value = Decimal("0")
        has_data = False
        for ticker in tickers:
            qty = qty_as_of(ticker, target_date)
            if qty > 0:
                price = price_as_of(ticker, target_date)
                if price is not None:
                    daily_value += qty * price
                    has_data = True

        if not has_data:
            raise ValueError("no priced positions for snapshot date")

        snapshot_dt = datetime.combine(target_date, datetime.min.time())
        with self._unit_of_work_factory() as unit_of_work:
            unit_of_work.snapshots.save_snapshot(
                date=snapshot_dt,
                total_value=daily_value,
            )
            unit_of_work.commit()

        return {
            "date": snapshot_dt.date().isoformat(),
            "value": daily_value,
            "cumulative_return": "0",
        }

    def list_snapshots(self) -> list[dict]:
        """Return all snapshots ordered by date ascending, with cumulative return."""
        with self._unit_of_work_factory() as unit_of_work:
            records = unit_of_work.snapshots.list_snapshots()
            snapshots: list[dict] = [
                {
                    "date": r.date,
                    "value": r.total_value,
                }
                for r in records
            ]

        if not snapshots:
            return []

        results = []
        first_value = None
        for snap in snapshots:
            value = snap["value"]
            if first_value is None:
                first_value = value
                cumulative_return = Decimal("0")
            else:
                cumulative_return = (value / first_value) - 1
            results.append(
                {
                    "date": snap["date"].date().isoformat(),
                    "value": value,
                    "cumulative_return": str(cumulative_return),
                }
            )
        return results

    def _today_in_tz(self) -> datetime:
        """Return the current date/time in the configured snapshot timezone."""
        tz = ZoneInfo(self.get_snapshot_timezone())
        return datetime.now(tz)
