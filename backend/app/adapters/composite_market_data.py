"""Composite market data provider with PPI fallback for Argentine Bonds and FCI."""

from collections.abc import Callable, Sequence
from datetime import date
from decimal import Decimal, InvalidOperation
import importlib
from typing import Any

from backend.app.domain.analysis import PricePoint, QuoteSnapshot
from backend.app.domain.tickers import (
    DEFAULT_SEARCH_RESULTS,
    TickerMatch,
    normalize_ticker,
)
from backend.app.adapters.ppi_market_data import PpiMarketDataProvider
from backend.app.application.ports import MarketDataProviderPort


def _to_currency(value: Any) -> str | None:
    """Normalize a provider currency field into a three-letter ISO code."""
    if not isinstance(value, str):
        return None
    candidate = value.strip().upper()
    if len(candidate) == 3 and candidate.isascii() and candidate.isalpha():
        return candidate
    return None


class CompositeMarketDataProvider(MarketDataProviderPort):
    """Market data provider that delegates to PPI for local bonds/FCI, yfinance for everything else."""

    def __init__(
        self,
        ppi_provider: PpiMarketDataProvider | None = None,
        yfinance_factory: Callable[[str], Any] | None = None,
        search_factory: Callable[[str, int], Any] | None = None,
    ) -> None:
        self._ppi = ppi_provider or PpiMarketDataProvider()
        self._yfinance_factory = yfinance_factory
        self._search_factory = search_factory
        self._yfinance_ticker_cache: dict[str, Any] = {}

    def _create_yfinance_ticker(self, ticker: str) -> Any:
        if self._yfinance_factory is not None:
            return self._yfinance_factory(ticker)
        if ticker not in self._yfinance_ticker_cache:
            yfinance_module = importlib.import_module("yfinance")
            self._yfinance_ticker_cache[ticker] = getattr(yfinance_module, "Ticker")(ticker)
        return self._yfinance_ticker_cache[ticker]

    def _create_yfinance_search(self, query: str, limit: int) -> Any:
        if self._search_factory is not None:
            return self._search_factory(query, limit)
        yfinance_module = importlib.import_module("yfinance")
        return getattr(yfinance_module, "Search")(query, max_results=limit)

    def _is_local_bond(self, ticker: str) -> bool:
        """Heuristic: Argentine bond tickers are alphanumeric, often end in letter+digit."""
        norm = normalize_ticker(ticker)
        # Known patterns: AL30, AL30D, GD30, AE38, AE38C, etc.
        # Keep it simple: if PPI has it cached, it will return a quote.
        # We just try PPI first for anything that looks like a local symbol.
        return len(norm) <= 10 and norm.isalnum()

    def get_quote(self, ticker: str) -> QuoteSnapshot | None:
        normalized = normalize_ticker(ticker)

        # First try PPI for local bonds and FCI
        quote = self._ppi.get_quote(normalized)
        if quote is not None:
            return quote

        # Fall back to yfinance
        try:
            info = self._create_yfinance_ticker(normalized).info
            for field in ("currentPrice", "regularMarketPrice", "previousClose"):
                raw_price = info.get(field)
                if raw_price is None:
                    continue
                try:
                    price = Decimal(str(raw_price))
                except InvalidOperation:
                    continue
                if price.is_finite() and price > 0:
                    return QuoteSnapshot(
                        price=price,
                        currency=_to_currency(info.get("currency")),
                    )
        except Exception:
            pass
        return None

    def get_historical_series(
        self, ticker: str, period: str
    ) -> Sequence[PricePoint]:
        # Historical series only available via yfinance
        try:
            history = self._create_yfinance_ticker(normalize_ticker(ticker)).history(period=period)
            points: list[PricePoint] = []
            for timestamp, raw_close in history["Close"].dropna().items():
                try:
                    close = Decimal(str(raw_close))
                except InvalidOperation:
                    continue
                if not (close.is_finite() and close > 0):
                    continue
                if isinstance(timestamp, date):
                    point_date = timestamp
                else:
                    point_date = timestamp.date()
                points.append(PricePoint(date=point_date, close=close))
            return tuple(points)
        except Exception:
            return ()

    def search_symbols(
        self, query: str, limit: int = DEFAULT_SEARCH_RESULTS
    ) -> Sequence[TickerMatch]:
        # Combine PPI results with yfinance results
        combined: list[TickerMatch] = []
        seen: set[str] = set()

        # First, PPI bonds and FCIs
        ppi_results = self._ppi.search_symbols(query, limit)
        for match in ppi_results:
            if match.symbol not in seen:
                seen.add(match.symbol)
                combined.append(match)
                if len(combined) >= limit:
                    return tuple(combined)

        # Then, yfinance
        try:
            results = self._create_yfinance_search(query, limit)
            quotes = getattr(results, "quotes", None) or ()
        except Exception:
            return tuple(combined)

        for quote in quotes:
            if not isinstance(quote, dict):
                continue
            if quote.get("isYahooFinance") is False:
                continue
            try:
                symbol = normalize_ticker(str(quote.get("symbol") or ""))
            except ValueError:
                continue
            if symbol in seen:
                continue
            seen.add(symbol)
            name = quote.get("longname") or quote.get("shortname") or symbol
            exchange = quote.get("exchDisp") or quote.get("exchange") or ""
            quote_type = quote.get("typeDisp") or quote.get("quoteType") or ""
            combined.append(
                TickerMatch(
                    symbol=symbol,
                    name=str(name),
                    exchange=str(exchange),
                    quote_type=str(quote_type),
                )
            )
            if len(combined) >= limit:
                break

        return tuple(combined)