"""Resolve an asset's quote currency without deriving it from its ticker."""

from backend.app.application.ports import MarketDataProviderPort


def resolve_currency(
    provider: MarketDataProviderPort | None, ticker: str
) -> str | None:
    """Return the provider-reported ISO currency for ``ticker``, if available.

    Currency is a property of the quoted instrument, not of the symbol spelling,
    so it must come from the market data provider. A missing provider, an
    unreachable quote, or an unknown currency stays ``None`` instead of falling
    back to a guessed default.
    """
    if provider is None:
        return None
    try:
        quote = provider.get_quote(ticker)
    except Exception:
        return None
    return None if quote is None else quote.currency
