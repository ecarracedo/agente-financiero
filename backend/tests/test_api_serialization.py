"""Unit tests for canonical Decimal serialization used by the API contract."""

from decimal import Decimal

import pytest

from backend.app.api.schemas import (
    CurrencyValuationResponse,
    SplitProjectionResponse,
)
from backend.app.api.serialization import format_money, format_quantity


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (Decimal("2"), "2"),
        (Decimal("30"), "30"),
        (Decimal("1000000"), "1000000"),
    ],
)
def test_format_money_canonicalizes_integers(value, expected):
    """Integer amounts drop any scale and trailing zeros."""
    assert format_money(value) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (Decimal("2.5"), "2.5"),
        (Decimal("2.50"), "2.5"),
        (Decimal("2.5000000000"), "2.5"),
        (Decimal("10.25"), "10.25"),
    ],
)
def test_format_money_keeps_one_or_two_decimals(value, expected):
    """One or two significant decimals are preserved without trailing zeros."""
    assert format_money(value) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (Decimal("2.567"), "2.57"),
        (Decimal("2.565"), "2.57"),
        (Decimal("2.564"), "2.56"),
        (Decimal("30.0000000000"), "30"),
        (Decimal("1000000.9999"), "1000001"),
    ],
)
def test_format_money_rounds_half_up_beyond_two_decimals(value, expected):
    """More than two decimals are rounded half-up at the serialization boundary."""
    assert format_money(value) == expected


def test_format_money_collapses_negative_zero():
    """A value rounding to zero serializes without a sign."""
    assert format_money(Decimal("-0.001")) == "0"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (Decimal("4.0000000000"), "4"),
        (Decimal("30.0000000000"), "30"),
        (Decimal("2.5"), "2.5"),
        (Decimal("100"), "100"),
    ],
)
def test_format_quantity_canonicalizes_without_scale(value, expected):
    """Quantities drop persistence scale without changing integer value."""
    assert format_quantity(value) == expected


def test_format_quantity_preserves_fractional_units_without_cap():
    """Quantities are canonicalized but never rounded to a fixed precision."""
    assert format_quantity(Decimal("0.3333333333")) == "0.3333333333"
    assert format_quantity(Decimal("1.125")) == "1.125"


def test_currency_valuation_response_rounds_money_and_keeps_missing_amounts():
    """Response schemas round money to two decimals and preserve absent totals."""
    modeled = CurrencyValuationResponse(
        currency="USD",
        invested_value=Decimal("10.005"),
        market_value=None,
        gain_loss=None,
        gain_loss_percent=None,
        unpriced_tickers=["AAPL"],
    )

    payload = modeled.model_dump(mode="json")

    assert payload["invested_value"] == "10.01"
    assert payload["market_value"] is None
    assert payload["gain_loss"] is None


def test_split_projection_response_separates_quantity_and_money_precision():
    """Split schemas canonicalize quantities while rounding money to two decimals."""
    modeled = SplitProjectionResponse(
        quantity=Decimal("0.3333333333"),
        average_price=Decimal("3.335"),
        ratio=Decimal("1.5"),
    )

    payload = modeled.model_dump(mode="json")

    assert payload["quantity"] == "0.3333333333"
    assert payload["average_price"] == "3.34"
    assert payload["ratio"] == "1.5"

