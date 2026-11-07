"""SQLAlchemy records for financial persistence."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
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
        Index("uq_portfolio_positions_source_id", "source_id", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
    __table_args__ = (
        Index("uq_portfolio_transactions_source_id", "source_id", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
    __table_args__ = (Index("uq_wishlist_items_source_id", "source_id", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    target_price: Mapped[Decimal | None] = mapped_column(Numeric(30, 10))
    alert_intent: Mapped[str | None] = mapped_column(String(16))
    last_observed_price: Mapped[Decimal | None] = mapped_column(Numeric(30, 10))


class BibliographyRecord(Base):
    """Persist a financial learning resource and optional metadata."""

    __tablename__ = "bibliography_items"
    __table_args__ = (Index("uq_bibliography_items_source_id", "source_id", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    author: Mapped[str] = mapped_column(String(200), nullable=False)
    year: Mapped[int | None] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="General")
    link: Mapped[str | None] = mapped_column(String(2000))
    description: Mapped[str | None] = mapped_column(Text)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)


class TickerAliasRecord(Base):
    """Persist a user-defined mapping from a broker ticker to an official name."""

    __tablename__ = "ticker_aliases"
    __table_args__ = (
        UniqueConstraint("broker_ticker", name="uq_ticker_alias_broker_ticker"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    broker_ticker: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    official_name: Mapped[str] = mapped_column(String(200), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="ppi")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)


class UserRecord(Base):
    """Persist the single application user with a hashed password."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    totp_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)


class AuthSessionRecord(Base):
    """Persist an opaque login session (full or pre-2FA) by token hash."""

    __tablename__ = "auth_sessions"
    __table_args__ = (
        Index("uq_auth_sessions_token_hash", "token_hash", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)
