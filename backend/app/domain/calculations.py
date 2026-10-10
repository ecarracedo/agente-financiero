"""Pure financial projection calculations using Decimal arithmetic."""

from decimal import Decimal


def calculate_split_projection(
    quantity: Decimal,
    average_price: Decimal,
    new_shares: int,
    old_shares: int,
) -> tuple[Decimal, Decimal, Decimal]:
    """Project quantity and average price after a forward or reverse split.

    Args:
        quantity: Current number of shares or units.
        average_price: Current average purchase price per unit.
        new_shares: Number of post-split shares in the ratio.
        old_shares: Number of pre-split shares in the ratio.

    Returns:
        Projected quantity, projected average price, and split ratio.

    Raises:
        ValueError: If the current quantity, price, or ratio is not positive.
    """
    if quantity <= 0 or average_price <= 0:
        raise ValueError("quantity and average price must be positive")
    if new_shares <= 0 or old_shares <= 0:
        raise ValueError("split ratio values must be positive")

    ratio = Decimal(new_shares) / Decimal(old_shares)
    return quantity * ratio, average_price / ratio, ratio
