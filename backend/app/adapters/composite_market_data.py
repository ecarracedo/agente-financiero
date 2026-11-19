"""Composite market data provider with PPI fallback for Argentine Bonds, FCI and ONs."""

from collections.abc import Callable, Iterable, Sequence
from datetime import date, datetime
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


def _is_bond_information(information: Any) -> bool:
    """Return True when the provider reports the instrument as a bond.

    Argentine ONs trade as a percentage of par (per 100 nominal units), so a
    ``BOND`` quote of 96.38 means 0.9638 per nominal unit. The caller applies
    that conversion; every other quote type keeps the provider's raw price.
    """
    if not isinstance(information, dict):
        return False
    quote_type = information.get("quoteType")
    return isinstance(quote_type, str) and quote_type.strip().upper() == "BOND"


def _scale_price_if_bond(price: Decimal, is_bond: bool) -> Decimal:
    """Divide a bond quote by 100; leave other instruments untouched."""
    return price / Decimal("100") if is_bond else price


def _flagged_per_hundred_tickers(loader: Callable[[], Iterable[object]] | None) -> set[str]:
    """Return the user-flagged per-100-nominal tickers, upper-cased.

    A failing loader never breaks pricing: it just yields no flags.
    """
    if loader is None:
        return set()
    try:
        values = loader()
    except Exception:
        return set()
    if values is None:
        return set()
    return {str(value).strip().upper() for value in values if str(value).strip()}


class CompositeMarketDataProvider(MarketDataProviderPort):
    """Market data provider that delegates to PPI for local bonds/FCI/ONs, yfinance otherwise."""

    def __init__(
        self,
        ppi_provider: PpiMarketDataProvider | None = None,
        yfinance_factory: Callable[[str], Any] | None = None,
        search_factory: Callable[[str, int], Any] | None = None,
        percent_of_par: Callable[[], Iterable[object]] | None = None,
    ) -> None:
        """Wire providers and the optional user-flagged per-100-nominal loader.

        Args:
            percent_of_par: Loader returning tickers the user flagged as quoted
                per 100 nominal units. It only affects the yfinance fallback,
                because PPI already reports per-100 prices divided by 100.
        """
        self._ppi = ppi_provider or PpiMarketDataProvider()
        self._yfinance_factory = yfinance_factory
        self._search_factory = search_factory
        self._percent_of_par = percent_of_par
        self._yfinance_ticker_cache: dict[str, Any] = {}

    def _is_per_hundred_nominal(self, ticker: str, information: Any = None) -> bool:
        """Return True when this ticker quotes per 100 nominal units."""
        if _is_bond_information(information):
            return True
        flagged = _flagged_per_hundred_tickers(self._percent_of_par)
        if not flagged:
            return False
        return normalize_ticker(ticker).upper() in flagged

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

        # First try PPI for local bonds, FCI and ONs
        quote = self._ppi.get_quote(normalized)
        if quote is not None:
            return quote

        # Fall back to yfinance
        try:
            info = self._create_yfinance_ticker(normalized).info
            is_per_hundred = self._is_per_hundred_nominal(normalized, info)
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
                        price=_scale_price_if_bond(price, is_per_hundred),
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
            ticker_obj = self._create_yfinance_ticker(normalize_ticker(ticker))
            is_per_hundred = False
            try:
                is_per_hundred = self._is_per_hundred_nominal(
                    ticker, getattr(ticker_obj, "info", None)
                )
            except Exception:
                # A failing info lookup must not lose the whole series; a
                # non-scaled series is no worse than the previous behavior.
                is_per_hundred = False
            history = ticker_obj.history(period=period)
            points: list[PricePoint] = []
            for timestamp, raw_close in history["Close"].dropna().items():
                try:
                    close = Decimal(str(raw_close))
                except InvalidOperation:
                    continue
                if not (close.is_finite() and close > 0):
                    continue
                close = _scale_price_if_bond(close, is_per_hundred)
                if isinstance(timestamp, datetime):
                    point_date = timestamp.date()
                elif isinstance(timestamp, date):
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

        # First, PPI bonds, FCIs and ONs
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