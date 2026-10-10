"""SQLAlchemy records for financial persistence."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for backend SQLAlchemy records."""


class PortfolioPositionRecord(Base):
    """Persist one position per ticker, broker, and category."""

    __tablename__ = "portfolio_positions"
    __table_args__ = (
        UniqueConstraint(
            "ticker", "broker", "category", name="uq_portfolio_position_identity"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    broker: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(30, 10), nullable=False)
    average_price: Mapped[Decimal] = mapped_column(Numeric(30, 10), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    target_price: Mapped[Decimal | None] = mapped_column(Numeric(30, 10))
    alert_intent: Mapped[str | None] = mapped_column(String(16))
    last_observed_price: Mapped[Decimal | None] = mapped_column(Numeric(30, 10))


class TransactionRecord(Base):
    """Persist a single buy or sell operation."""

    __tablename__ = "portfolio_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    broker: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    operation_type: Mapped[str] = mapped_column(String(8), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(30, 10), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(30, 10), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class WishlistRecord(Base):
    """Persist one watched ticker and its optional target price."""

    __tablename__ = "wishlist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    target_price: Mapped[Decimal | None] = mapped_column(Numeric(30, 10))
    alert_intent: Mapped[str | None] = mapped_column(String(16))
    last_observed_price: Mapped[Decimal | None] = mapped_column(Numeric(30, 10))


class BibliographyRecord(Base):
    """Persist a financial learning resource and optional metadata."""

    __tablename__ = "bibliography_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    author: Mapped[str] = mapped_column(String(200), nullable=False)
    year: Mapped[int | None] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="General")
    link: Mapped[str | None] = mapped_column(String(2000))
    description: Mapped[str | None] = mapped_column(Text)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)
