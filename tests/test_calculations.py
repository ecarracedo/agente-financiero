"""Tests for pure financial projection calculations."""

import pytest

from src.services.calculations import calculate_split_projection


@pytest.mark.parametrize(
    ("quantity", "average_price", "new_shares", "old_shares", "expected"),
    [
        (100.0, 10.0, 2, 1, (200.0, 5.0, 2.0)),
        (100.0, 10.0, 1, 4, (25.0, 40.0, 0.25)),
    ],
)
def test_split_projection_preserves_position_value(
    quantity, average_price, new_shares, old_shares, expected
):
    """Forward and reverse splits adjust quantity and average inversely."""
    result = calculate_split_projection(
        quantity, average_price, new_shares, old_shares
    )

    assert result == expected
