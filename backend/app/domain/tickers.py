"""Canonical ticker normalization shared by every entry point.

Tickers enter this system through path parameters, request bodies, query
parameters, and the legacy migration adapter. Keeping the rule in one place
means every entry point produces the same canonical symbol and rejects the same
invalid input, instead of each caller re-implementing ``strip().upper()``.
"""

MAX_TICKER_LENGTH = 32


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
