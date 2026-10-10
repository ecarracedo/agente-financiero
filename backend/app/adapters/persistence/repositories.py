"""Repository adapters for portfolio positions and transactions."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.adapters.persistence.models import (
    BibliographyRecord,
    PortfolioPositionRecord,
    TransactionRecord,
    WishlistRecord,
)
from backend.app.domain.alerts import AlertIntent, TargetAlertSettings
from backend.app.domain.portfolio import PortfolioPosition


class SqlAlchemyPortfolioRepository:
    """Persist and retrieve portfolio state without owning transaction commits."""

    def __init__(self, session: Session) -> None:
        """Initialize the repository with a caller-managed SQLAlchemy session."""
        self._session = session

    def get_position(
        self, ticker: str, broker: str, category: str
    ) -> PortfolioPosition | None:
        """Load a position by its ticker, broker, and category identity."""
        statement = select(PortfolioPositionRecord).where(
            PortfolioPositionRecord.ticker == ticker.strip().upper(),
            PortfolioPositionRecord.broker == broker.strip(),
            PortfolioPositionRecord.category == category,
        )
        record = self._session.scalar(statement)
        if record is None:
            return None
        return PortfolioPosition(
            ticker=record.ticker,
            broker=record.broker,
            category=record.category,
            quantity=record.quantity,
            average_price=record.average_price,
            currency=record.currency,
        )

    def list_positions(self) -> list[PortfolioPosition]:
        """Return all positions in stable ticker/broker/category order."""
        statement = select(PortfolioPositionRecord).order_by(
            PortfolioPositionRecord.ticker,
            PortfolioPositionRecord.broker,
            PortfolioPositionRecord.category,
        )
        return [
            PortfolioPosition(
                ticker=record.ticker,
                broker=record.broker,
                category=record.category,
                quantity=record.quantity,
                average_price=record.average_price,
                currency=record.currency,
            )
            for record in self._session.scalars(statement)
        ]

    def save_position(self, position: PortfolioPosition) -> None:
        """Insert or update a position within the caller's transaction."""
        statement = select(PortfolioPositionRecord).where(
            PortfolioPositionRecord.ticker == position.ticker,
            PortfolioPositionRecord.broker == position.broker,
            PortfolioPositionRecord.category == position.category,
        )
        record = self._session.scalar(statement)
        if record is None:
            record = PortfolioPositionRecord(
                ticker=position.ticker,
                broker=position.broker,
                category=position.category,
                quantity=position.quantity,
                average_price=position.average_price,
                currency=position.currency,
            )
            self._session.add(record)
            return
        record.quantity = position.quantity
        record.average_price = position.average_price
        record.currency = position.currency

    def delete_position(self, ticker: str, broker: str, category: str) -> None:
        """Remove a position by its business identity within the transaction."""
        statement = select(PortfolioPositionRecord).where(
            PortfolioPositionRecord.ticker == ticker.strip().upper(),
            PortfolioPositionRecord.broker == broker.strip(),
            PortfolioPositionRecord.category == category,
        )
        record = self._session.scalar(statement)
        if record is not None:
            self._session.delete(record)

    def set_position_alert(
        self,
        ticker: str,
        broker: str,
        category: str,
        settings: TargetAlertSettings,
    ) -> bool:
        """Set alert intent for an existing portfolio position."""
        statement = select(PortfolioPositionRecord).where(
            PortfolioPositionRecord.ticker == ticker.strip().upper(),
            PortfolioPositionRecord.broker == broker.strip(),
            PortfolioPositionRecord.category == category,
        )
        record = self._session.scalar(statement)
        if record is None:
            return False
        record.target_price = settings.target_price
        record.alert_intent = settings.intent.value
        record.last_observed_price = None
        return True

    def get_position_alert(
        self, ticker: str, broker: str, category: str
    ) -> TargetAlertSettings | None:
        """Load configured alert settings; unresolved legacy intents stay inactive."""
        statement = select(PortfolioPositionRecord).where(
            PortfolioPositionRecord.ticker == ticker.strip().upper(),
            PortfolioPositionRecord.broker == broker.strip(),
            PortfolioPositionRecord.category == category,
        )
        record = self._session.scalar(statement)
        if record is None or record.target_price is None or record.alert_intent is None:
            return None
        try:
            intent = AlertIntent(record.alert_intent)
        except ValueError:
            return None
        return TargetAlertSettings(
            record.target_price, intent, record.last_observed_price
        )

    def update_position_alert_price(
        self, ticker: str, broker: str, category: str, price: Decimal
    ) -> bool:
        """Save the latest observed quote for duplicate-crossing suppression."""
        statement = select(PortfolioPositionRecord).where(
            PortfolioPositionRecord.ticker == ticker.strip().upper(),
            PortfolioPositionRecord.broker == broker.strip(),
            PortfolioPositionRecord.category == category,
        )
        record = self._session.scalar(statement)
        if record is None:
            return False
        record.last_observed_price = price
        return True

    def add_transaction(
        self,
        *,
        ticker: str,
        broker: str,
        category: str,
        operation_type: str,
        quantity: Decimal,
        unit_price: Decimal,
        currency: str,
        occurred_at: datetime,
    ) -> TransactionRecord:
        """Add an operation to the caller's transaction and return its record."""
        record = TransactionRecord(
            ticker=ticker.strip().upper(),
            broker=broker.strip(),
            category=category,
            operation_type=operation_type,
            quantity=quantity,
            unit_price=unit_price,
            currency=currency.strip().upper(),
            occurred_at=occurred_at,
        )
        self._session.add(record)
        self._session.flush()
        return record

    def list_transactions(self, ticker: str, broker: str) -> list[TransactionRecord]:
        """Return an asset's operations ordered chronologically and by id."""
        statement = (
            select(TransactionRecord)
            .where(
                TransactionRecord.ticker == ticker.strip().upper(),
                TransactionRecord.broker == broker.strip(),
            )
            .order_by(TransactionRecord.occurred_at, TransactionRecord.id)
        )
        return list(self._session.scalars(statement))

    def get_transaction(self, transaction_id: int) -> TransactionRecord | None:
        """Load one transaction by its database identifier."""
        return self._session.get(TransactionRecord, transaction_id)

    def delete_transaction(self, transaction_id: int) -> bool:
        """Delete one transaction within the caller's transaction."""
        record = self.get_transaction(transaction_id)
        if record is None:
            return False
        self._session.delete(record)
        return True


class SqlAlchemyResourceRepository:
    """Repository adapter for wishlist and bibliography resources."""

    def __init__(self, session: Session) -> None:
        """Initialize the repository with a caller-managed SQLAlchemy session."""
        self._session = session

    def add_wishlist_item(self, ticker: str) -> WishlistRecord:
        """Add a normalized ticker to the wishlist."""
        record = WishlistRecord(ticker=ticker.strip().upper())
        self._session.add(record)
        self._session.flush()
        return record

    def update_wishlist_target(
        self, ticker: str, target_price: Decimal | None
    ) -> bool:
        """Update an existing wishlist target and report whether it existed."""
        statement = select(WishlistRecord).where(
            WishlistRecord.ticker == ticker.strip().upper()
        )
        record = self._session.scalar(statement)
        if record is None:
            return False
        record.target_price = target_price
        return True

    def set_wishlist_alert(
        self, ticker: str, settings: TargetAlertSettings
    ) -> bool:
        """Set target intent for an existing wishlist item."""
        statement = select(WishlistRecord).where(
            WishlistRecord.ticker == ticker.strip().upper()
        )
        record = self._session.scalar(statement)
        if record is None:
            return False
        record.target_price = settings.target_price
        record.alert_intent = settings.intent.value
        record.last_observed_price = None
        return True

    def get_wishlist_alert(self, ticker: str) -> TargetAlertSettings | None:
        """Load configured wishlist alert settings; legacy unresolved rows stay inactive."""
        statement = select(WishlistRecord).where(
            WishlistRecord.ticker == ticker.strip().upper()
        )
        record = self._session.scalar(statement)
        if record is None or record.target_price is None or record.alert_intent is None:
            return None
        try:
            intent = AlertIntent(record.alert_intent)
        except ValueError:
            return None
        return TargetAlertSettings(
            record.target_price, intent, record.last_observed_price
        )

    def update_wishlist_alert_price(self, ticker: str, price: Decimal) -> bool:
        """Save the latest observed wishlist quote for crossing suppression."""
        statement = select(WishlistRecord).where(
            WishlistRecord.ticker == ticker.strip().upper()
        )
        record = self._session.scalar(statement)
        if record is None:
            return False
        record.last_observed_price = price
        return True

    def list_wishlist(self) -> list[WishlistRecord]:
        """Return wishlist entries in ticker order."""
        statement = select(WishlistRecord).order_by(WishlistRecord.ticker)
        return list(self._session.scalars(statement))

    def remove_wishlist_item(self, ticker: str) -> bool:
        """Remove a wishlist ticker and report whether it existed."""
        statement = select(WishlistRecord).where(
            WishlistRecord.ticker == ticker.strip().upper()
        )
        record = self._session.scalar(statement)
        if record is None:
            return False
        self._session.delete(record)
        return True

    def add_bibliography_item(
        self,
        *,
        title: str,
        author: str,
        year: int | None = None,
        category: str = "General",
        link: str | None = None,
        description: str | None = None,
    ) -> BibliographyRecord:
        """Add a bibliography resource with optional descriptive metadata."""
        record = BibliographyRecord(
            title=title.strip(),
            author=author.strip(),
            year=year,
            category=category,
            link=link,
            description=description,
        )
        self._session.add(record)
        self._session.flush()
        return record

    def list_bibliography(self) -> list[BibliographyRecord]:
        """Return bibliography resources ordered by newest creation first."""
        statement = select(BibliographyRecord).order_by(BibliographyRecord.added_at.desc())
        return list(self._session.scalars(statement))

    def remove_bibliography_item(self, item_id: int) -> bool:
        """Remove a bibliography resource and report whether it existed."""
        record = self._session.get(BibliographyRecord, item_id)
        if record is None:
            return False
        self._session.delete(record)
        return True
