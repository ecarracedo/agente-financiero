"""YFinance adapter for current and historical market prices."""

from collections.abc import Callable
from decimal import Decimal, InvalidOperation
import importlib
from typing import Any


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

    def get_historical_closes(self, ticker: str, period: str) -> list[Decimal]:
        """Return valid historical close values or an empty list on failure."""
        try:
            history = self._create_ticker(ticker).history(period=period)
            raw_closes = history["Close"].dropna().tolist()
            closes = []
            for raw_close in raw_closes:
                try:
                    close = Decimal(str(raw_close))
                except InvalidOperation:
                    continue
                if close.is_finite() and close > 0:
                    closes.append(close)
            return closes
        except Exception:
            return []
