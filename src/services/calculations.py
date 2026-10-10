"""Pure financial projection calculations."""


def calculate_split_projection(
    quantity: float,
    average_price: float,
    new_shares: int,
    old_shares: int,
) -> tuple[float, float, float]:
    """Project quantity, average price, and ratio after a stock split.

    The projection preserves the position's total value by scaling quantity
    and average price in opposite directions.

    Args:
        quantity: Current number of shares or units.
        average_price: Current average purchase price per share or unit.
        new_shares: Number of shares after the split ratio.
        old_shares: Number of shares before the split ratio.

    Returns:
        A tuple containing projected quantity, projected average price,
        and the new-to-old share ratio.
    """
    ratio = new_shares / old_shares
    return quantity * ratio, average_price / ratio, ratio
