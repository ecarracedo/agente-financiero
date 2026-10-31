"""Transactional portfolio use cases."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from backend.app.application.ports import PortfolioUnitOfWorkFactory
from backend.app.domain.portfolio import PortfolioPosition, apply_purchase, apply_sale


@dataclass(frozen=True)
class TransactionSummary:
    """Represent a transaction without exposing an ORM record."""

    id: int
    ticker: str
    broker: str
    category: str
    operation_type: str
    quantity: Decimal
    unit_price: Decimal
    currency: str
    occurred_at: datetime


class PortfolioUseCases:
    """Coordinate portfolio domain operations and atomic persistence."""

    def __init__(self, unit_of_work_factory: PortfolioUnitOfWorkFactory) -> None:
        """Initialize portfolio use cases with a caller-supplied UoW factory."""
        self._unit_of_work_factory = unit_of_work_factory

    def get_position(
        self, ticker: str, broker: str, category: str
    ) -> PortfolioPosition | None:
        """Return one normalized portfolio position."""
        with self._unit_of_work_factory() as unit_of_work:
            return unit_of_work.portfolio.get_position(ticker, broker, category)

    def list_positions(self) -> list[PortfolioPosition]:
        """Return all portfolio positions in stable repository order."""
        with self._unit_of_work_factory() as unit_of_work:
            return unit_of_work.portfolio.list_positions()

    def record_purchase(
        self,
        *,
        ticker: str,
        broker: str,
        category: str,
        quantity: Decimal,
        unit_price: Decimal,
        currency: str,
        occurred_at: datetime,
    ) -> PortfolioPosition:
        """Record a purchase and update position atomically."""
        with self._unit_of_work_factory() as unit_of_work:
            repository = unit_of_work.portfolio
            position = apply_purchase(
                repository.get_position(ticker, broker, category),
                ticker=ticker,
                broker=broker,
                category=category,
                quantity=quantity,
                unit_price=unit_price,
                currency=currency,
            )
            repository.add_transaction(
                ticker=ticker,
                broker=broker,
                category=category,
                operation_type="BUY",
                quantity=quantity,
                unit_price=unit_price,
                currency=currency,
                occurred_at=occurred_at,
            )
            repository.save_position(position)
            unit_of_work.commit()
            return position

    def record_sale(
        self,
        *,
        ticker: str,
        broker: str,
        category: str,
        quantity: Decimal,
        unit_price: Decimal,
        currency: str,
        occurred_at: datetime,
    ) -> PortfolioPosition | None:
        """Record a sale and update or remove its position atomically."""
        with self._unit_of_work_factory() as unit_of_work:
            repository = unit_of_work.portfolio
            position = repository.get_position(ticker, broker, category)
            if position is None:
                raise ValueError("position does not exist")
            updated_position = apply_sale(
                position, quantity=quantity, currency=currency
            )
            repository.add_transaction(
                ticker=ticker,
                broker=broker,
                category=category,
                operation_type="SELL",
                quantity=quantity,
                unit_price=unit_price,
                currency=currency,
                occurred_at=occurred_at,
            )
            if updated_position is None:
                repository.delete_position(ticker, broker, category)
            else:
                repository.save_position(updated_position)
            unit_of_work.commit()
            return updated_position

    def list_history(self, ticker: str, broker: str) -> list[TransactionSummary]:
        """Return chronologically ordered transaction summaries."""
        with self._unit_of_work_factory() as unit_of_work:
            records = unit_of_work.portfolio.list_transactions(ticker, broker)
            return [
                TransactionSummary(
                    id=record.id,
                    ticker=record.ticker,
                    broker=record.broker,
                    category=record.category,
                    operation_type=record.operation_type,
                    quantity=record.quantity,
                    unit_price=record.unit_price,
                    currency=record.currency,
                    occurred_at=record.occurred_at,
                )
                for record in records
            ]

    def delete_transaction(self, transaction_id: int) -> bool:
        """Delete a transaction and rebuild its position from remaining history."""
        with self._unit_of_work_factory() as unit_of_work:
            repository = unit_of_work.portfolio
            deleted = repository.get_transaction(transaction_id)
            if deleted is None:
                return False
            repository.delete_transaction(transaction_id)

            position: PortfolioPosition | None = None
            for transaction in repository.list_transactions(deleted.ticker, deleted.broker):
                if transaction.operation_type == "BUY":
                    position = apply_purchase(
                        position,
                        ticker=transaction.ticker,
                        broker=transaction.broker,
                        category=transaction.category,
                        quantity=transaction.quantity,
                        unit_price=transaction.unit_price,
                        currency=transaction.currency,
                    )
                elif transaction.operation_type == "SELL":
                    if position is None:
                        raise ValueError("history contains a sale without a position")
                    position = apply_sale(
                        position,
                        quantity=transaction.quantity,
                        currency=transaction.currency,
                    )
                else:
                    raise ValueError("history contains an unknown operation type")

            if position is None:
                repository.delete_position(
                    deleted.ticker, deleted.broker, deleted.category
                )
            else:
                repository.save_position(position)
            unit_of_work.commit()
            return True
