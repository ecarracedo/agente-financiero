"""Immutable portfolio entities and financial position operations."""

from dataclasses import dataclass, replace
from decimal import Decimal
import re

from backend.app.domain.tickers import normalize_ticker

_CURRENCY_CODE = re.compile(r"^[A-Z]{3}$")


def _normalize_currency(currency: str) -> str:
    """Normalize and validate a three-letter ISO currency code."""
    normalized = currency.strip().upper()
    if not _CURRENCY_CODE.fullmatch(normalized):
        raise ValueError("currency must be a three-letter ISO code")
    return normalized


@dataclass(frozen=True)
class PortfolioPosition:
    """Represent one ticker and broker position in a single currency."""

    ticker: str
    broker: str
    category: str
    quantity: Decimal
    average_price: Decimal
    currency: str

    def __post_init__(self) -> None:
        """Normalize identifiers and validate the position's monetary state."""
        normalized_ticker = normalize_ticker(self.ticker)
        normalized_broker = self.broker.strip()
        if not normalized_broker or not self.category.strip():
            raise ValueError("ticker, broker, and category are required")
        if self.quantity <= 0:
            raise ValueError("position quantity must be positive")
        if self.average_price <= 0:
            raise ValueError("average price must be positive")
        object.__setattr__(self, "ticker", normalized_ticker)
        object.__setattr__(self, "broker", normalized_broker)
        object.__setattr__(self, "currency", _normalize_currency(self.currency))


def apply_purchase(
    position: PortfolioPosition | None,
    *,
    ticker: str,
    broker: str,
    category: str,
    quantity: Decimal,
    unit_price: Decimal,
    currency: str,
) -> PortfolioPosition:
    """Apply a purchase and return a new position with weighted average cost.

    A new position is created when ``position`` is ``None``. Existing positions
    can only be extended when ticker, broker, category, and currency match.
    Monetary and quantity values use Decimal arithmetic without implicit FX or
    rounding.

    Args:
        position: Existing immutable position, or ``None`` for a first purchase.
        ticker: Asset symbol for the purchase.
        broker: Broker holding the position.
        category: Portfolio category.
        quantity: Positive number of units purchased.
        unit_price: Positive purchase price per unit.
        currency: Three-letter ISO currency code.

    Returns:
        A new position containing the resulting quantity and average price.

    Raises:
        ValueError: If values are invalid or the purchase conflicts with the
            existing position's identity or currency.
    """
    normalized_ticker = normalize_ticker(ticker)
    normalized_broker = broker.strip()
    normalized_currency = _normalize_currency(currency)
    if quantity <= 0 or unit_price <= 0:
        raise ValueError("purchase quantity and unit price must be positive")

    if position is None:
        return PortfolioPosition(
            ticker=normalized_ticker,
            broker=normalized_broker,
            category=category,
            quantity=quantity,
            average_price=unit_price,
            currency=normalized_currency,
        )

    if (
        position.ticker != normalized_ticker
        or position.broker != normalized_broker
        or position.category != category
    ):
        raise ValueError("purchase identity does not match the existing position")
    if position.currency != normalized_currency:
        raise ValueError("purchase currency does not match the existing position currency")

    new_quantity = position.quantity + quantity
    new_average = (
        position.quantity * position.average_price + quantity * unit_price
    ) / new_quantity
    return replace(position, quantity=new_quantity, average_price=new_average)


def apply_sale(
    position: PortfolioPosition,
    *,
    quantity: Decimal,
    currency: str,
) -> PortfolioPosition | None:
    """Apply a sale without changing the remaining average purchase price.

    Args:
        position: Existing position to reduce.
        quantity: Positive number of units sold.
        currency: Three-letter ISO currency code used by the sale.

    Returns:
        The reduced position, or ``None`` when the entire position is sold.

    Raises:
        ValueError: If the quantity is invalid, exceeds available units, or
            the sale currency differs from the position currency.
    """
    normalized_currency = _normalize_currency(currency)
    if normalized_currency != position.currency:
        raise ValueError("sale currency does not match the position currency")
    if quantity <= 0:
        raise ValueError("sale quantity must be positive")
    if quantity > position.quantity:
        raise ValueError("sale quantity exceeds available quantity")
    if quantity == position.quantity:
        return None
    return replace(position, quantity=position.quantity - quantity)
