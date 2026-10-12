"""YFinance adapter for current and historical market prices."""

from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import importlib
from typing import Any

from backend.app.domain.analysis import PricePoint


def _to_date(timestamp: Any) -> date | None:
    """Convert a provider index entry into a calendar date when possible.

    Args:
        timestamp: A pandas Timestamp, a ``datetime``/``date``, or a string.

    Returns:
        A ``date`` for a recognizable value, otherwise ``None``.
    """
    if isinstance(timestamp, datetime):
        return timestamp.date()
    if isinstance(timestamp, date):
        return timestamp
    try:
        return date.fromisoformat(str(timestamp)[:10])
    except ValueError:
        return None


class YFinanceMarketDataProvider:
    """Fetch market data and normalize numeric values to Decimal."""

    def __init__(self, ticker_factory: Callable[[str], Any] | None = None) -> None:
        """Initialize with an optional ticker factory for isolated tests."""
        self._ticker_factory = ticker_factory

    def _create_ticker(self, ticker: str) -> Any:
        """Create a yfinance ticker lazily or use the injected factory."""
        if self._ticker_factory is not None:
            return self._ticker_factory(ticker)
        yfinance_module = importlib.import_module("yfinance")
        return getattr(yfinance_module, "Ticker")(ticker)

    def get_current_price(self, ticker: str) -> Decimal | None:
        """Return a positive current quote or None when the provider has none."""
        try:
            information = self._create_ticker(ticker).info
            for field in ("currentPrice", "regularMarketPrice", "previousClose"):
                raw_price = information.get(field)
                if raw_price is None:
                    continue
                try:
                    price = Decimal(str(raw_price))
                except InvalidOperation:
                    continue
                if price.is_finite() and price > 0:
                    return price
        except Exception:
            return None
        return None

    def get_historical_series(
        self, ticker: str, period: str
    ) -> tuple[PricePoint, ...]:
        """Return dated historical closes in provider order, or empty on failure.

        Missing, non-positive, or undated provider entries are skipped so the
        series never carries invented prices.
        """
        try:
            history = self._create_ticker(ticker).history(period=period)
            dated_closes = history["Close"].dropna()
            points: list[PricePoint] = []
            for timestamp, raw_close in dated_closes.items():
                try:
                    close = Decimal(str(raw_close))
                except InvalidOperation:
                    continue
                if not (close.is_finite() and close > 0):
                    continue
                point_date = _to_date(timestamp)
                if point_date is None:
                    continue
                points.append(PricePoint(date=point_date, close=close))
            return tuple(points)
        except Exception:
            return ()
