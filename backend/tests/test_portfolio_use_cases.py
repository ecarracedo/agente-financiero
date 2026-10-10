"""Tests for transactional portfolio application use cases."""

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy.orm import sessionmaker

from backend.app.adapters.persistence.unit_of_work import SqlAlchemyPortfolioUnitOfWork
from backend.app.application.portfolio import PortfolioUseCases


@pytest.fixture
def portfolio_use_cases(session):
    """Build portfolio use cases backed by the isolated test database."""
    session_factory = sessionmaker(bind=session.get_bind())
    return PortfolioUseCases(
        lambda: SqlAlchemyPortfolioUnitOfWork(session_factory)
    )


def test_purchase_and_sale_update_position_and_history(portfolio_use_cases):
    """Purchases and sales commit position changes and matching history rows."""
    first_date = datetime(2024, 1, 1)
    second_date = datetime(2024, 1, 2)

    first = portfolio_use_cases.record_purchase(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        unit_price=Decimal("10"),
        currency="USD",
        occurred_at=first_date,
    )
    updated = portfolio_use_cases.record_purchase(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        unit_price=Decimal("20"),
        currency="USD",
        occurred_at=second_date,
    )
    remaining = portfolio_use_cases.record_sale(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("1"),
        unit_price=Decimal("15"),
        currency="USD",
        occurred_at=datetime(2024, 1, 3),
    )

    assert first.quantity == Decimal("2")
    assert updated.quantity == Decimal("4")
    assert updated.average_price == Decimal("15")
    assert remaining.quantity == Decimal("3")
    assert remaining.average_price == Decimal("15")
    history = portfolio_use_cases.list_history("AAPL", "Broker A")
    assert [row.operation_type for row in history] == [
        "BUY",
        "BUY",
        "SELL",
    ]
    assert history[-1].unit_price == Decimal("15")


def test_oversale_rolls_back_without_recording_transaction(portfolio_use_cases):
    """A rejected sale leaves both position and transaction history unchanged."""
    portfolio_use_cases.record_purchase(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("2"),
        unit_price=Decimal("10"),
        currency="USD",
        occurred_at=datetime(2024, 1, 1),
    )

    with pytest.raises(ValueError, match="exceeds available quantity"):
        portfolio_use_cases.record_sale(
            ticker="AAPL",
            broker="Broker A",
            category="Acciones",
            quantity=Decimal("3"),
            unit_price=Decimal("12"),
            currency="USD",
            occurred_at=datetime(2024, 1, 2),
        )

    assert portfolio_use_cases.get_position("AAPL", "Broker A", "Acciones").quantity == Decimal("2")
    assert [row.operation_type for row in portfolio_use_cases.list_history("AAPL", "Broker A")] == ["BUY"]


def test_deleting_sale_replays_history_to_restore_position(portfolio_use_cases):
    """Deleting a sale reconstructs the position from the remaining operations."""
    for operation_date, quantity, unit_price in (
        (datetime(2024, 1, 1), Decimal("2"), Decimal("10")),
        (datetime(2024, 1, 2), Decimal("2"), Decimal("20")),
    ):
        portfolio_use_cases.record_purchase(
            ticker="AAPL",
            broker="Broker A",
            category="Acciones",
            quantity=quantity,
            unit_price=unit_price,
            currency="USD",
            occurred_at=operation_date,
        )
    portfolio_use_cases.record_sale(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("1"),
        unit_price=Decimal("15"),
        currency="USD",
        occurred_at=datetime(2024, 1, 3),
    )
    sale = portfolio_use_cases.list_history("AAPL", "Broker A")[-1]

    assert portfolio_use_cases.delete_transaction(sale.id) is True

    restored = portfolio_use_cases.get_position("AAPL", "Broker A", "Acciones")
    assert restored.quantity == Decimal("4")
    assert restored.average_price == Decimal("15")
    assert len(portfolio_use_cases.list_history("AAPL", "Broker A")) == 2


def test_deleting_last_purchase_removes_position(portfolio_use_cases):
    """Removing the only purchase removes its now-empty position."""
    portfolio_use_cases.record_purchase(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("1"),
        unit_price=Decimal("10"),
        currency="USD",
        occurred_at=datetime(2024, 1, 1),
    )
    transaction = portfolio_use_cases.list_history("AAPL", "Broker A")[0]

    assert portfolio_use_cases.delete_transaction(transaction.id) is True
    assert portfolio_use_cases.get_position("AAPL", "Broker A", "Acciones") is None
    assert portfolio_use_cases.list_history("AAPL", "Broker A") == []
