"""Tests for Decimal-based financial projections."""

from decimal import Decimal

import pytest

from backend.app.domain.calculations import calculate_split_projection


@pytest.mark.parametrize(
    ("quantity", "average_price", "new_shares", "old_shares", "expected"),
    [
        (
            Decimal("100"),
            Decimal("10"),
            2,
            1,
            (Decimal("200"), Decimal("5"), Decimal("2")),
        ),
        (
            Decimal("100"),
            Decimal("10"),
            1,
            4,
            (Decimal("25"), Decimal("40"), Decimal("0.25")),
        ),
    ],
)
def test_split_projection_preserves_decimal_position_value(
    quantity, average_price, new_shares, old_shares, expected
):
    """Forward and reverse split projections conserve the position value."""
    projection = calculate_split_projection(
        quantity, average_price, new_shares, old_shares
    )

    assert projection == expected
    assert projection[0] * projection[1] == quantity * average_price
