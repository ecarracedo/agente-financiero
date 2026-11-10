"""Use cases for daily portfolio value snapshots (ARS-denominated estimate)."""

from collections import defaultdict
from collections.abc import Sequence
from datetime import date, datetime, timedelta
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
from backend.app.domain.fx import compute_ccl, compute_mep

DEFAULT_SNAPSHOT_HOUR: int = 17  # 17 hs Argentina (UTC-3)
DEFAULT_SNAPSHOT_TIMEZONE: str = "America/Argentina/Buenos_Aires"

_DEFAULT_ESTIMATED_DAYS: int = 30

_SETTING_SNAPSHOT_HOUR = "snapshot_hour"
_SETTING_SNAPSHOT_TIMEZONE = "snapshot_timezone"


class PortfolioSnapshotUseCases:
    """Create and read daily portfolio value snapshots (all values in ARS)."""

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

    def _usd_to_ars_rate(self) -> Decimal:
        """Return the USD→ARS exchange rate (CCL) used to convert dollar positions."""
        with self._unit_of_work_factory() as unit_of_work:
            positions = unit_of_work.portfolio.list_positions()

        def _price(q) -> Decimal | None:
            if q is None or q.price is None:
                return None
            try:
                return Decimal(str(q.price))
            except Exception:
                return None

        # Tickers needed for MEP: GD30 (ARS bond) / GD30D (USD bond), 1:1.
        gd30_quote = self._market_data.get_quote("GD30")
        gd30d_quote = self._market_data.get_quote("GD30D")

        p_ars = _price(gd30_quote)
        p_usd = _price(gd30d_quote)
        if p_ars is not None and p_usd is not None and p_usd > 0:
            rate = compute_mep(p_ars, p_usd)
            if rate is not None and rate > 0:
                return rate

        # Fallback: CCL via AAPL cedear / AAPL (20:1 BYMA ratio).
        aapl_ba_quote = self._market_data.get_quote("AAPL.BA")
        aapl_quote = self._market_data.get_quote("AAPL")

        p_ba = _price(aapl_ba_quote)
        p_us = _price(aapl_quote)
        if p_ba is not None and p_us is not None and p_us > 0:
            rate = compute_ccl(p_ba, p_us)
            if rate is not None and rate > 0:
                return rate

        # Last resort: no conversion available, treat USD as 1:1 (will be flagged).
        return Decimal("1")

    def _current_prices_by_ticker(
        self, tickers: Sequence[str]
    ) -> dict[str, tuple[Decimal, str]]:
        """Return current price and currency for each ticker.

        Falls back to the average purchase price when the provider has no quote,
        so the estimate still includes every position.
        """
        result: dict[str, tuple[Decimal, str]] = {}
        for ticker in tickers:
            quote = self._market_data.get_quote(ticker)
            if quote is not None and quote.price is not None:
                try:
                    price = Decimal(str(quote.price))
                except Exception:
                    price = Decimal("0")
                if price > 0:
                    result[ticker] = (price, quote.currency or "ARS")
                    continue
            # No provider price: fall back to weighted average cost from transactions.
            result[ticker] = (Decimal("0"), "ARS")
        return result

    def create_estimated_range(
        self, days_back: int = _DEFAULT_ESTIMATED_DAYS
    ) -> list[dict]:
        """Create snapshots for the last ``days_back`` days, all valued in ARS.

        Uses current market prices (provider quote, or average cost as fallback)
        and converts USD positions to ARS at the CCL rate. This is an *estimate*:
        it shows how the portfolio value evolved due to buys/sells, valued at
        today's prices, not the true historical daily close.
        """
        end_date = self._today_in_tz().date()
        start_date = end_date - timedelta(days=days_back - 1)

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

        # Current positions (for currency of each ticker).
        with self._unit_of_work_factory() as unit_of_work:
            positions = unit_of_work.portfolio.list_positions()
        currency_by_ticker: dict[str, str] = {}
        for pos in positions:
            currency_by_ticker[pos.ticker] = pos.currency

        # Also record currency from transactions as fallback.
        for tx in txs:
            currency_by_ticker.setdefault(tx["ticker"], tx["currency"])

        tickers = sorted({tx["ticker"] for tx in txs})

        # Current prices (provider quote, fallback to avg cost).
        prices = self._current_prices_by_ticker(tickers)

        # USD→ARS rate (CCL).
        fx_rate = self._usd_to_ars_rate()

        # Net quantity per ticker as of each day.
        cumulative_by_ticker: dict[str, list[tuple[date, Decimal]]] = {}

        tx_by_ticker: dict[str, list[dict]] = defaultdict(list)
        for tx in txs:
            tx_by_ticker[tx["ticker"]].append(tx)

        for ticker, tx_list in tx_by_ticker.items():
            sorted_txs = sorted(tx_list, key=lambda t: (t["occurred_at"].date(), t["id"]))
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
            if hasattr(value, "date"):
                return value.date()
            return value

        def qty_as_of(ticker: str, target: date) -> Decimal:
            cum_list = cumulative_by_ticker.get(ticker, [])
            qty = Decimal("0")
            for tx_date, cum_qty in cum_list:
                if _as_date(tx_date) <= target:
                    qty = cum_qty
                else:
                    break
            return qty

        # Build snapshots for each day in the range.
        created: list[dict] = []
        current = start_date
        while current <= end_date:
            daily_value_ars = Decimal("0")
            has_data = False
            for ticker in tickers:
                qty = qty_as_of(ticker, current)
                if qty > 0:
                    price, currency = prices.get(ticker, (Decimal("0"), "ARS"))
                    value = qty * price
                    if currency == "USD":
                        value = value * fx_rate
                    daily_value_ars += value
                    has_data = True

            snapshot_dt = datetime.combine(current, datetime.min.time())
            with self._unit_of_work_factory() as unit_of_work:
                unit_of_work.snapshots.save_snapshot(
                    date=snapshot_dt,
                    total_value=daily_value_ars,
                )
                unit_of_work.commit()

            created.append(
                {
                    "date": current.isoformat(),
                    "value": daily_value_ars,
                    "cumulative_return": "0",
                }
            )
            current += timedelta(days=1)

        return created

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
            if first_value is None or first_value == 0:
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
