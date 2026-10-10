"""Tests for immutable portfolio domain operations."""

from decimal import Decimal

import pytest

from backend.app.domain.portfolio import PortfolioPosition, apply_purchase, apply_sale


def test_purchase_creates_position_with_currency():
    """A first purchase creates a position with exact decimal values."""
    position = apply_purchase(
        None,
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        unit_price=Decimal("10.25"),
        currency="USD",
    )

    assert position == PortfolioPosition(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        average_price=Decimal("10.25"),
        currency="USD",
    )


def test_purchase_updates_weighted_average():
    """A subsequent purchase computes the exact weighted average."""
    position = PortfolioPosition(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        average_price=Decimal("10"),
        currency="USD",
    )

    updated = apply_purchase(
        position,
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("1"),
        unit_price=Decimal("16"),
        currency="USD",
    )

    assert updated.quantity == Decimal("3")
    assert updated.average_price == Decimal("12")
    assert updated.currency == "USD"


def test_purchase_rejects_mixed_currency():
    """A purchase cannot combine monetary values from different currencies."""
    position = PortfolioPosition(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        average_price=Decimal("10"),
        currency="USD",
    )

    with pytest.raises(ValueError, match="currency"):
        apply_purchase(
            position,
            ticker="AAPL",
            broker="Broker A",
            category="Acciones",
            quantity=Decimal("1"),
            unit_price=Decimal("10000"),
            currency="ARS",
        )


def test_sale_reduces_quantity_without_changing_average():
    """A partial sale preserves the average purchase price."""
    position = PortfolioPosition(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("5"),
        average_price=Decimal("12.50"),
        currency="USD",
    )

    updated = apply_sale(position, quantity=Decimal("2"), currency="USD")

    assert updated.quantity == Decimal("3")
    assert updated.average_price == Decimal("12.50")
    assert position.quantity == Decimal("5")


def test_sale_rejects_oversell_without_mutating_position():
    """An oversale fails and leaves the immutable source position unchanged."""
    position = PortfolioPosition(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        average_price=Decimal("12.50"),
        currency="USD",
    )

    with pytest.raises(ValueError, match="exceeds available quantity"):
        apply_sale(position, quantity=Decimal("3"), currency="USD")

    assert position.quantity == Decimal("2")
    assert position.average_price == Decimal("12.50")


def test_sale_of_entire_position_returns_none():
    """Selling the entire position signals that it should be removed."""
    position = PortfolioPosition(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        average_price=Decimal("12.50"),
        currency="USD",
    )

    assert apply_sale(position, quantity=Decimal("2"), currency="USD") is None


def test_sale_rejects_mixed_currency():
    """A sale cannot use a currency different from the position currency."""
    position = PortfolioPosition(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        average_price=Decimal("12.50"),
        currency="USD",
    )

    with pytest.raises(ValueError, match="currency"):
        apply_sale(position, quantity=Decimal("1"), currency="ARS")
