"""Read-only reader for a preserved copy of the legacy SQLite database.

The reader opens the source with ``file:<path>?mode=ro`` so it can never write
to the legacy file. It maps the four legacy tables into frozen dataclasses and
returns them as a single :class:`SourceSnapshot`.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


class SourceNotFoundError(FileNotFoundError):
    """Raised when the legacy source database file does not exist."""


@dataclass(frozen=True)
class SourcePortfolioItem:
    """A single legacy ``portfolioitem`` row."""

    ticker: str
    quantity: float
    category: str
    source_sheet: str
    broker: str
    avg_price: float
    target_price: float | None
    updated_at: datetime | None


@dataclass(frozen=True)
class SourceTransaction:
    """A single legacy ``transaction`` row (operation_type Compra/Venta)."""

    date: datetime | None
    ticker: str
    operation_type: str
    quantity: float
    price: float
    broker: str
    category: str
    date_error: str | None = field(default=None)


@dataclass(frozen=True)
class SourceWishlistItem:
    """A single legacy ``wishlistitem`` row."""

    ticker: str
    target_price: float | None
    added_at: datetime | None


@dataclass(frozen=True)
class SourceBibliographyItem:
    """A single legacy ``bibliographyitem`` row."""

    title: str
    author: str
    year: int | None
    category: str
    link: str | None
    description: str | None
    added_at: datetime | None


@dataclass(frozen=True)
class SourceSnapshot:
    """An in-memory, read-only view of every legacy entity list."""

    portfolio_items: tuple[SourcePortfolioItem, ...]
    transactions: tuple[SourceTransaction, ...]
    wishlist_items: tuple[SourceWishlistItem, ...]
    bibliography_items: tuple[SourceBibliographyItem, ...]


def _parse_datetime(raw: object) -> tuple[datetime | None, str | None]:
    """Parse a legacy datetime string, returning the error text when invalid."""
    if raw is None:
        return None, None
    text = str(raw).strip()
    if not text:
        return None, None
    try:
        return datetime.fromisoformat(text), None
    except ValueError:
        return None, text


def _parse_int(raw: Any) -> int | None:
    """Parse a legacy integer column, tolerating NULL and empty values."""
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _as_float(raw: Any) -> float:
    """Coerce a legacy numeric column to float (0.0 when NULL)."""
    if raw is None:
        return 0.0
    return float(raw)


def open_read_only_connection(path: str | Path) -> sqlite3.Connection:
    """Open the legacy database read-only via a ``mode=ro`` URI.

    Raises:
        SourceNotFoundError: when the database file does not exist.
    """
    database_path = Path(path)
    if not database_path.is_file():
        raise SourceNotFoundError(f"legacy source database not found: {database_path}")
    uri = f"file:{database_path}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def _read_portfolio_items(connection: sqlite3.Connection) -> tuple[SourcePortfolioItem, ...]:
    """Read every ``portfolioitem`` row into typed dataclasses."""
    rows = connection.execute("SELECT * FROM portfolioitem ORDER BY id")
    items = []
    for row in rows:
        updated_at, _ = _parse_datetime(row["updated_at"])
        items.append(
            SourcePortfolioItem(
                ticker=row["ticker"] or "",
                quantity=_as_float(row["quantity"]),
                category=row["category"] or "",
                source_sheet=row["source_sheet"] or "",
                broker=row["broker"] or "",
                avg_price=_as_float(row["avg_price"]),
                target_price=None if row["target_price"] is None else float(row["target_price"]),
                updated_at=updated_at,
            )
        )
    return tuple(items)


def _read_transactions(connection: sqlite3.Connection) -> tuple[SourceTransaction, ...]:
    """Read every ``transaction`` row into typed dataclasses."""
    rows = connection.execute('SELECT * FROM "transaction" ORDER BY id')
    items = []
    for row in rows:
        date, date_error = _parse_datetime(row["date"])
        items.append(
            SourceTransaction(
                date=date,
                ticker=row["ticker"] or "",
                operation_type=row["operation_type"] or "",
                quantity=_as_float(row["quantity"]),
                price=_as_float(row["price"]),
                broker=row["broker"] or "",
                category=row["category"] or "",
                date_error=date_error,
            )
        )
    return tuple(items)


def _read_wishlist_items(connection: sqlite3.Connection) -> tuple[SourceWishlistItem, ...]:
    """Read every ``wishlistitem`` row into typed dataclasses."""
    rows = connection.execute("SELECT * FROM wishlistitem ORDER BY id")
    items = []
    for row in rows:
        added_at, _ = _parse_datetime(row["added_at"])
        items.append(
            SourceWishlistItem(
                ticker=row["ticker"] or "",
                target_price=None if row["target_price"] is None else float(row["target_price"]),
                added_at=added_at,
            )
        )
    return tuple(items)


def _read_bibliography_items(connection: sqlite3.Connection) -> tuple[SourceBibliographyItem, ...]:
    """Read every ``bibliographyitem`` row into typed dataclasses."""
    rows = connection.execute("SELECT * FROM bibliographyitem ORDER BY id")
    items = []
    for row in rows:
        added_at, _ = _parse_datetime(row["added_at"])
        items.append(
            SourceBibliographyItem(
                title=row["title"] or "",
                author=row["author"] or "",
                year=_parse_int(row["year"]),
                category=row["category"] or "",
                link=row["link"],
                description=row["description"],
                added_at=added_at,
            )
        )
    return tuple(items)


def read_source(path: str | Path) -> SourceSnapshot:
    """Read a legacy source copy read-only and return its typed snapshot.

    The connection is always opened in ``mode=ro``; no write statement is ever
    issued against the source.

    Raises:
        SourceNotFoundError: when the database file does not exist.
    """
    connection = open_read_only_connection(path)
    try:
        return SourceSnapshot(
            portfolio_items=_read_portfolio_items(connection),
            transactions=_read_transactions(connection),
            wishlist_items=_read_wishlist_items(connection),
            bibliography_items=_read_bibliography_items(connection),
        )
    finally:
        connection.close()
