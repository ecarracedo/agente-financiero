"""YFinance adapter for current and historical market prices."""

from collections.abc import Callable, Iterable
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


def _to_currency(value: Any) -> str | None:
    """Normalize a provider currency field into a three-letter ISO code.

    Args:
        value: The raw provider value, usually a short code such as ``"ARS"``.

    Returns:
        The upper-cased code when it is three ASCII letters, otherwise ``None``.
    """
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


def _scale_price_if_bond(price: Decimal, is_bond: bool) -> Decimal:
    """Divide a bond quote by 100; leave other instruments untouched."""
    return price / Decimal("100") if is_bond else price


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

    def __init__(
        self,
        ticker_factory: Callable[[str], Any] | None = None,
        search_factory: Callable[[str, int], Any] | None = None,
        percent_of_par: Callable[[], Iterable[object]] | None = None,
    ) -> None:
        """Initialize with optional ticker and search factories for isolated tests.

        Args:
            percent_of_par: Optional loader returning the tickers the user
                flagged as quoted per 100 nominal units. Yahoo reports BYMA ONs
                as ``EQUITY`` without any bond marker, so the ``BOND``
                quoteType heuristic cannot see them; this hook is how the user
                declares them.
        """
        self._ticker_factory = ticker_factory
        self._search_factory = search_factory
        self._percent_of_par = percent_of_par

    def _is_per_hundred_nominal(self, ticker: str, information: Any = None) -> bool:
        """Return True when this ticker quotes per 100 nominal units."""
        if _is_bond_information(information):
            return True
        flagged = _flagged_per_hundred_tickers(self._percent_of_par)
        if not flagged:
            return False
        candidate = ticker.strip().upper()
        return candidate in flagged

    def _create_ticker(self, ticker: str) -> Any:
        """Create a yfinance ticker lazily or use the injected factory."""
        if self._ticker_factory is not None:
            return self._ticker_factory(ticker)
        yfinance_module = importlib.import_module("yfinance")
        return getattr(yfinance_module, "Ticker")(ticker)

    def _create_search(self, query: str, limit: int) -> Any:
        """Create a yfinance symbol search lazily or use the injected factory."""
        if self._search_factory is not None:
            return self._search_factory(query, limit)
        yfinance_module = importlib.import_module("yfinance")
        return getattr(yfinance_module, "Search")(query, max_results=limit)

    def search_symbols(
        self, query: str, limit: int = DEFAULT_SEARCH_RESULTS
    ) -> tuple[TickerMatch, ...]:
        """Return provider symbol matches for a free-text query.

        Provider entries without a usable symbol are skipped, repeated symbols are
        collapsed, and a provider failure yields no matches rather than inventing
        them, so a search never offers an instrument the API cannot quote later.
        """
        try:
            results = self._create_search(query, limit)
            quotes = getattr(results, "quotes", None) or ()
        except Exception:
            return ()

        matches: list[TickerMatch] = []
        seen: set[str] = set()
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
            matches.append(
                TickerMatch(
                    symbol=symbol,
                    name=str(name),
                    exchange=str(exchange),
                    quote_type=str(quote_type),
                )
            )
            if len(matches) >= limit:
                break
        return tuple(matches)

    def get_quote(self, ticker: str) -> QuoteSnapshot | None:
        """Return the current price and its quote currency, or None.

        One provider information lookup answers both, so a price and its
        currency can never come from two different snapshots. A quote without a
        recognizable ISO currency keeps its price and reports the currency as
        unknown rather than guessing dollars.
        """
        try:
            information = self._create_ticker(ticker).info
            is_per_hundred = self._is_per_hundred_nominal(ticker, information)
            for field in ("currentPrice", "regularMarketPrice", "previousClose"):
                raw_price = information.get(field)
                if raw_price is None:
                    continue
                try:
                    price = Decimal(str(raw_price))
                except InvalidOperation:
                    continue
                if price.is_finite() and price > 0:
                    return QuoteSnapshot(
                        price=_scale_price_if_bond(price, is_per_hundred),
                        currency=_to_currency(information.get("currency")),
                    )
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
            ticker_obj = self._create_ticker(ticker)
            is_per_hundred = False
            try:
                is_per_hundred = self._is_per_hundred_nominal(
                    ticker, getattr(ticker_obj, "info", None)
                )
            except Exception:
                # A failing info lookup must not lose the whole history; a
                # non-scaled series is no worse than the previous behavior.
                is_per_hundred = False
            history = ticker_obj.history(period=period)
            dated_closes = history["Close"].dropna()
            points: list[PricePoint] = []
            for timestamp, raw_close in dated_closes.items():
                try:
                    close = Decimal(str(raw_close))
                except InvalidOperation:
                    continue
                if not (close.is_finite() and close > 0):
                    continue
                close = _scale_price_if_bond(close, is_per_hundred)
                point_date = _to_date(timestamp)
                if point_date is None:
                    continue
                points.append(PricePoint(date=point_date, close=close))
            return tuple(points)
        except Exception:
            return ()
