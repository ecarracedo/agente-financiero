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

DEFAULT_ESTIMATED_DAYS: int = 30
DEFAULT_CATCH_UP_DAYS: int = 7

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

    def _load_transactions(self) -> list[dict]:
        """Return every stored transaction as a plain dict used for valuation."""
        with self._unit_of_work_factory() as unit_of_work:
            records = unit_of_work.portfolio.list_all_transactions()
            return [
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

    @staticmethod
    def _cumulative_quantities(
        txs: Sequence[dict],
    ) -> dict[str, list[tuple[date, Decimal]]]:
        """Return the net quantity per ticker after each transaction date."""
        cumulative: dict[str, list[tuple[date, Decimal]]] = defaultdict(list)
        tx_by_ticker: dict[str, list[dict]] = defaultdict(list)
        for tx in txs:
            tx_by_ticker[tx["ticker"]].append(tx)

        for ticker, tx_list in tx_by_ticker.items():
            sorted_txs = sorted(tx_list, key=lambda t: (t["occurred_at"].date(), t["id"]))
            cum_qty = Decimal("0")
            for tx in sorted_txs:
                if tx["operation_type"] == "BUY":
                    cum_qty += tx["quantity"]
                elif tx["operation_type"] == "SELL":
                    cum_qty -= tx["quantity"]
                cumulative[ticker].append((tx["occurred_at"].date(), cum_qty))
        return cumulative

    @staticmethod
    def _net_quantity_as_of(
        cumulative: dict[str, list[tuple[date, Decimal]]],
        ticker: str,
        target: date,
    ) -> Decimal:
        """Return the net quantity of ``ticker`` at the end of ``target``."""
        quantity = Decimal("0")
        for tx_date, cum_qty in cumulative.get(ticker, []):
            if tx_date <= target:
                quantity = cum_qty
            else:
                break
        return quantity

    def _portfolio_value_for(
        self,
        target: date,
        *,
        txs: Sequence[dict],
        prices: dict[str, tuple[Decimal, str]],
        fx_rate: Decimal,
        cumulative: dict[str, list[tuple[date, Decimal]]],
    ) -> Decimal:
        """Return the ARS value of the portfolio at its ``target``-day quantities."""
        total = Decimal("0")
        for ticker in sorted({tx["ticker"] for tx in txs}):
            quantity = self._net_quantity_as_of(cumulative, ticker, target)
            if quantity <= 0:
                continue
            price, currency = prices.get(ticker, (Decimal("0"), "ARS"))
            value = quantity * price
            if currency == "USD":
                value = value * fx_rate
            total += value
        return total

    def _save_snapshot(self, target: date, value: Decimal) -> None:
        """Persist the snapshot of ``target``, replacing any previous value."""
        with self._unit_of_work_factory() as unit_of_work:
            unit_of_work.snapshots.save_snapshot(
                date=datetime.combine(target, datetime.min.time()),
                total_value=value,
            )
            unit_of_work.commit()

    def create_estimated_range(
        self, days_back: int = DEFAULT_ESTIMATED_DAYS
    ) -> list[dict]:
        """Create snapshots for the last ``days_back`` days, all valued in ARS.

        Uses current market prices (provider quote, or average cost as fallback)
        and converts USD positions to ARS at the CCL rate. This is an *estimate*:
        it shows how the portfolio value evolved due to buys/sells, valued at
        today's prices, not the true historical daily close.
        """
        end_date = self._today_in_tz().date()
        start_date = end_date - timedelta(days=days_back - 1)

        txs = self._load_transactions()
        if not txs:
            raise ValueError("no transactions to snapshot")

        tickers = sorted({tx["ticker"] for tx in txs})
        prices = self._current_prices_by_ticker(tickers)
        fx_rate = self._usd_to_ars_rate()
        cumulative = self._cumulative_quantities(txs)

        created: list[dict] = []
        current = start_date
        while current <= end_date:
            daily_value_ars = self._portfolio_value_for(
                current,
                txs=txs,
                prices=prices,
                fx_rate=fx_rate,
                cumulative=cumulative,
            )
            self._save_snapshot(current, daily_value_ars)
            created.append(
                {
                    "date": current.isoformat(),
                    "value": daily_value_ars,
                    "cumulative_return": "0",
                }
            )
            current += timedelta(days=1)

        return created

    def create_today_snapshot(self) -> dict:
        """Persist today's snapshot with current prices and the CCL rate.

        Only today's row is written, so the daily job never rewrites the
        historical series with today's valuations.
        """
        target = self._today_in_tz().date()
        txs = self._load_transactions()
        if not txs:
            raise ValueError("no transactions to snapshot")

        tickers = sorted({tx["ticker"] for tx in txs})
        value = self._portfolio_value_for(
            target,
            txs=txs,
            prices=self._current_prices_by_ticker(tickers),
            fx_rate=self._usd_to_ars_rate(),
            cumulative=self._cumulative_quantities(txs),
        )
        self._save_snapshot(target, value)
        return {"date": target.isoformat(), "value": value, "cumulative_return": "0"}

    def is_snapshot_due(self, *, now: datetime | None = None) -> bool:
        """Return True when today's snapshot is missing and its hour has arrived."""
        moment = now if now is not None else self._today_in_tz()
        if moment.hour < self.get_snapshot_hour():
            return False

        today = moment.date()
        with self._unit_of_work_factory() as unit_of_work:
            records = unit_of_work.snapshots.list_snapshots()
        return all(record.date.date() != today for record in records)

    def backfill_missing_days(
        self,
        days_back: int = DEFAULT_CATCH_UP_DAYS,
        *,
        now: datetime | None = None,
    ) -> list[dict]:
        """Write the missing days of the recent window, leaving saved rows alone.

        Only days before today are recovered: today belongs to the daily job.
        Recovered days are valued at current prices, so they are an estimate of
        how the portfolio evolved (buys/sells), not the real close of that day.
        """
        today = (now if now is not None else self._today_in_tz()).date()

        with self._unit_of_work_factory() as unit_of_work:
            stored = {
                record.date.date()
                for record in unit_of_work.snapshots.list_snapshots()
            }

        targets: list[date] = []
        current = today - timedelta(days=days_back)
        while current < today:
            if current not in stored:
                targets.append(current)
            current += timedelta(days=1)

        if not targets:
            return []

        txs = self._load_transactions()
        if not txs:
            raise ValueError("no transactions to snapshot")

        tickers = sorted({tx["ticker"] for tx in txs})
        prices = self._current_prices_by_ticker(tickers)
        fx_rate = self._usd_to_ars_rate()
        cumulative = self._cumulative_quantities(txs)

        created: list[dict] = []
        for target in targets:
            value = self._portfolio_value_for(
                target,
                txs=txs,
                prices=prices,
                fx_rate=fx_rate,
                cumulative=cumulative,
            )
            self._save_snapshot(target, value)
            created.append(
                {
                    "date": target.isoformat(),
                    "value": value,
                    "cumulative_return": "0",
                }
            )
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
