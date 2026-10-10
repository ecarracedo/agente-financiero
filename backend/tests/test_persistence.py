"""Tests for SQLAlchemy portfolio persistence adapters."""

from datetime import datetime
from decimal import Decimal

from backend.app.adapters.persistence.repositories import SqlAlchemyPortfolioRepository
from backend.app.domain.portfolio import PortfolioPosition

def test_position_repository_round_trips_decimal_values(session):
    """Position persistence preserves currency and decimal precision."""
    repository = SqlAlchemyPortfolioRepository(session)
    position = PortfolioPosition(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("1.25000000"),
        average_price=Decimal("123.45678901"),
        currency="USD",
    )

    with session.begin():
        repository.save_position(position)

    restored = repository.get_position("AAPL", "Broker A", "Acciones")

    assert restored == position
    assert restored.quantity == Decimal("1.25000000")
    assert restored.average_price == Decimal("123.45678901")
    assert restored.currency == "USD"


def test_position_repository_lists_positions_by_identity(session):
    """Portfolio reads return all persisted positions in stable order."""
    repository = SqlAlchemyPortfolioRepository(session)
    positions = [
        PortfolioPosition(
            ticker="MSFT",
            broker="Broker B",
            category="Acciones",
            quantity=Decimal("1"),
            average_price=Decimal("20"),
            currency="USD",
        ),
        PortfolioPosition(
            ticker="AAPL",
            broker="Broker A",
            category="Acciones",
            quantity=Decimal("2"),
            average_price=Decimal("10"),
            currency="USD",
        ),
    ]

    with session.begin():
        for position in positions:
            repository.save_position(position)

    listed = repository.list_positions()

    assert [(position.ticker, position.broker) for position in listed] == [
        ("AAPL", "Broker A"),
        ("MSFT", "Broker B"),
    ]


def test_transaction_repository_round_trips_operation_history(session):
    """Transaction persistence returns ordered records with monetary currency."""
    repository = SqlAlchemyPortfolioRepository(session)
    first_date = datetime(2024, 1, 1)
    second_date = datetime(2024, 1, 2)

    with session.begin():
        first = repository.add_transaction(
            ticker="AAPL",
            broker="Broker A",
            category="Acciones",
            operation_type="BUY",
            quantity=Decimal("2"),
            unit_price=Decimal("10.25"),
            currency="USD",
            occurred_at=first_date,
        )
        repository.add_transaction(
            ticker="AAPL",
            broker="Broker A",
            category="Acciones",
            operation_type="SELL",
            quantity=Decimal("1"),
            unit_price=Decimal("12.00"),
            currency="USD",
            occurred_at=second_date,
        )

    history = repository.list_transactions("AAPL", "Broker A")

    assert first.id is not None
    assert [record.operation_type for record in history] == ["BUY", "SELL"]
    assert [record.occurred_at for record in history] == [first_date, second_date]
    assert [record.quantity for record in history] == [Decimal("2"), Decimal("1")]
    assert all(record.currency == "USD" for record in history)


def test_repository_does_not_commit_caller_transaction(session):
    """Repository writes participate in the caller's transaction boundary."""
    repository = SqlAlchemyPortfolioRepository(session)

    with session.begin_nested():
        repository.save_position(
            PortfolioPosition(
                ticker="AAPL",
                broker="Broker A",
                category="Acciones",
                quantity=Decimal("1"),
                average_price=Decimal("10"),
                currency="USD",
            )
        )
        session.rollback()

    assert repository.get_position("AAPL", "Broker A", "Acciones") is None
