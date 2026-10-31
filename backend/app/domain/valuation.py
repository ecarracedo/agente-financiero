"""Currency-aware portfolio valuation rules."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Mapping

from backend.app.domain.portfolio import PortfolioPosition


@dataclass(frozen=True)
class CurrencyValuation:
    """Aggregate position values without combining unlike currencies."""

    currency: str
    invested_value: Decimal
    market_value: Decimal | None
    gain_loss: Decimal | None
    gain_loss_percent: Decimal | None
    unpriced_tickers: tuple[str, ...]


def value_portfolio(
    positions: list[PortfolioPosition],
    current_prices: Mapping[str, Decimal | None],
) -> dict[str, CurrencyValuation]:
    """Calculate holdings value and gain/loss separately for each currency.

    If one or more holdings in a currency have no current quote, market value
    and gain/loss for that currency are unknown rather than treated as zero.
    Values in different currencies are never combined or implicitly converted.

    Args:
        positions: Immutable positions to value.
        current_prices: Latest known quote by normalized ticker, or ``None`` if
            the provider has no quote for that ticker.

    Returns:
        Currency-keyed valuation summaries in first-seen currency order.
    """
    grouped: dict[str, list[PortfolioPosition]] = {}
    for position in positions:
        grouped.setdefault(position.currency, []).append(position)

    results: dict[str, CurrencyValuation] = {}
    for currency, currency_positions in grouped.items():
        invested_value = sum(
            (
                position.quantity * position.average_price
                for position in currency_positions
            ),
            Decimal("0"),
        )
        priced_positions: list[tuple[PortfolioPosition, Decimal]] = []
        unpriced_ticker_list: list[str] = []
        for position in currency_positions:
            current_price = current_prices.get(position.ticker)
            if current_price is None:
                unpriced_ticker_list.append(position.ticker)
            else:
                priced_positions.append((position, current_price))
        unpriced_tickers = tuple(sorted(unpriced_ticker_list))
        if unpriced_tickers:
            market_value = None
            gain_loss = None
            gain_loss_percent = None
        else:
            market_value = sum(
                (
                    position.quantity * current_price
                    for position, current_price in priced_positions
                ),
                Decimal("0"),
            )
            gain_loss = market_value - invested_value
            gain_loss_percent = gain_loss / invested_value * Decimal("100")

        results[currency] = CurrencyValuation(
            currency=currency,
            invested_value=invested_value,
            market_value=market_value,
            gain_loss=gain_loss,
            gain_loss_percent=gain_loss_percent,
            unpriced_tickers=unpriced_tickers,
        )
    return results
