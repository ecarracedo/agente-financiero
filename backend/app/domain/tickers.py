"""Canonical ticker normalization shared by every entry point.

Tickers enter this system through path parameters, request bodies, query
parameters, and the legacy migration adapter. Keeping the rule in one place
means every entry point produces the same canonical symbol and rejects the same
invalid input, instead of each caller re-implementing ``strip().upper()``.
"""

from dataclasses import dataclass

MAX_TICKER_LENGTH = 32

# The most matches a single search request may return. The API validates the
# caller-supplied limit against the same bound so no request can ask for an
# unbounded provider response.
MAX_SEARCH_RESULTS = 25

# Matches returned when a caller does not ask for a specific amount.
DEFAULT_SEARCH_RESULTS = 8


@dataclass(frozen=True)
class TickerMatch:
    """One provider symbol match for an asset search.

    Attributes:
        symbol: Canonical ticker symbol returned by the provider.
        name: Human-readable instrument name.
        exchange: Provider exchange label, or an empty string when absent.
        quote_type: Provider instrument type, such as ``Equity`` or ``Crypto``.
    """

    symbol: str
    name: str
    exchange: str
    quote_type: str


def normalize_ticker(raw: str) -> str:
    """Return the canonical ticker symbol, or raise when it is invalid.

    The canonical form is the stripped, upper-cased symbol. Casing and
    surrounding whitespace are presentation details, so both are removed rather
    than rejected.

    Args:
        raw: Ticker symbol exactly as supplied by a caller.

    Returns:
        The canonical ticker symbol.

    Raises:
        ValueError: If the symbol is empty after stripping, or longer than
            ``MAX_TICKER_LENGTH``. An over-long symbol is rejected rather than
            truncated because silently storing a different symbol than the one
            requested would corrupt the identity of the asset.
    """
    normalized = raw.strip().upper()
    if not normalized:
        raise ValueError("ticker is required")
    if len(normalized) > MAX_TICKER_LENGTH:
        raise ValueError(f"ticker must be at most {MAX_TICKER_LENGTH} characters")
    return normalized
