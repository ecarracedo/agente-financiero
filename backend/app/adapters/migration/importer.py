"""Transactional, idempotent import of a validated legacy snapshot.

The importer maps a :class:`SourceSnapshot` into the destination inside ONE
transaction, keyed on the legacy row ``source_id``. A row absent from the
destination is inserted; a row already present with equal compared fields is
skipped (duplicate); a row present with changed fields is updated in place.
Re-running an import never creates duplicates.

The transaction commits only when the validation report is ``ready``; on any
other error the transaction rolls back so the destination is never left
partially migrated.

Legacy monetary values are Python ``float``. They are converted with
``Decimal(str(value))`` (never ``Decimal(float)``) and quantized to ten decimal
places with ``ROUND_HALF_UP`` to fit ``Numeric(30, 10)``. Integer-ish values
round-trip exactly because quantizing only adds trailing zeros.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.adapters.persistence.models import (
    BibliographyRecord,
    PortfolioPositionRecord,
    TransactionRecord,
    WishlistRecord,
)

from .report import EntityImportResult, ImportResult, ValidationReport
from .source import (
    SourceBibliographyItem,
    SourcePortfolioItem,
    SourceSnapshot,
    SourceTransaction,
    SourceWishlistItem,
)
from .validation import (
    BIBLIOGRAPHY_ITEMS,
    PORTFOLIO_ITEMS,
    TRANSACTIONS,
    WISHLIST_ITEMS,
    CurrencyMapping,
    normalize_currency_mapping,
)

#: Decimal quantum matching ``Numeric(30, 10)`` storage scale.
OP_QUANTUM = Decimal("0.0000000001")

OPERATION_TYPE_MAP: Mapping[str, str] = {"Compra": "BUY", "Venta": "SELL"}


class ImportNotReadyError(RuntimeError):
    """Raised when an import is requested without a ready validation report."""


def to_decimal(value: float) -> Decimal:
    """Convert a legacy float via its string form and quantize to ten places.

    Quantization to ``Numeric(30, 10)`` scale happens here and is documented as
    the single precision boundary for imported legacy money.
    """
    return Decimal(str(value)).quantize(OP_QUANTUM, rounding=ROUND_HALF_UP)


def to_optional_decimal(value: float | None) -> Decimal | None:
    """Convert an optional legacy float, preserving ``None``."""
    return None if value is None else to_decimal(value)


def _problem_count(report: ValidationReport, entity: str) -> int:
    """Count validation problems (rejected or unresolved) for one entity."""
    return len(report.rejected_for(entity)) + len(report.unresolved_for(entity))


def _require_currency(mapping: Mapping[str, str], ticker: str) -> str:
    """Return the explicit currency for a ticker or raise defensively."""
    currency = mapping.get(ticker.strip().upper())
    if currency is None:
        raise ValueError(f"missing explicit currency mapping for ticker {ticker!r}")
    return currency.strip().upper()


def _upsert(
    session: Session,
    model: type[Any],
    source_id: int,
    fields: dict[str, object],
    *,
    on_insert: dict[str, object] | None = None,
) -> str:
    """Insert, skip, or update one destination row keyed by ``source_id``.

    Returns ``"inserted"``, ``"skipped"``, or ``"updated"``. ``on_insert``
    supplies extra columns set only on first insert (never compared, never
    touched on update).
    """
    record = session.scalar(select(model).where(model.source_id == source_id))
    if record is None:
        session.add(model(source_id=source_id, **fields, **(on_insert or {})))
        return "inserted"
    if all(getattr(record, key) == value for key, value in fields.items()):
        return "skipped"
    for key, value in fields.items():
        setattr(record, key, value)
    return "updated"


def _portfolio_fields(item: SourcePortfolioItem, currency: str) -> dict[str, object]:
    """Build the compared destination fields for one legacy portfolio row."""
    return {
        "ticker": item.ticker,
        "broker": item.broker,
        "category": item.category,
        "quantity": to_decimal(item.quantity),
        "average_price": to_decimal(item.avg_price),
        "currency": currency,
        "target_price": to_optional_decimal(item.target_price),
    }


def _transaction_fields(
    item: SourceTransaction, currency: str
) -> dict[str, object]:
    """Build the compared destination fields for one legacy transaction row."""
    operation_type = OPERATION_TYPE_MAP.get(item.operation_type)
    if operation_type is None:
        raise ValueError(f"unmapped operation_type: {item.operation_type!r}")
    if item.date is None:
        raise ValueError(f"transaction without a date: source id {item.source_id}")
    return {
        "ticker": item.ticker,
        "broker": item.broker,
        "category": item.category,
        "operation_type": operation_type,
        "quantity": to_decimal(item.quantity),
        "unit_price": to_decimal(item.price),
        "currency": currency,
        "occurred_at": item.date,
    }


def _wishlist_fields(item: SourceWishlistItem) -> dict[str, object]:
    """Build the compared destination fields for one legacy wishlist row."""
    return {
        "ticker": item.ticker,
        "target_price": to_optional_decimal(item.target_price),
    }


def _bibliography_fields(item: SourceBibliographyItem) -> dict[str, object]:
    """Build the compared destination fields for one legacy bibliography row."""
    return {
        "title": item.title,
        "author": item.author,
        "year": item.year,
        "category": item.category,
        "link": item.link,
        "description": item.description,
    }


def _import_portfolio(
    session: Session,
    items: tuple[SourcePortfolioItem, ...],
    mapping: Mapping[str, str],
) -> EntityImportResult:
    """Import portfolio rows and count their idempotent outcomes."""
    inserted = updated = skipped = 0
    for item in items:
        currency = _require_currency(mapping, item.ticker)
        outcome = _upsert(
            session,
            PortfolioPositionRecord,
            item.source_id,
            _portfolio_fields(item, currency),
        )
        if outcome == "inserted":
            inserted += 1
        elif outcome == "updated":
            updated += 1
        else:
            skipped += 1
    return EntityImportResult(inserted=inserted, updated=updated, skipped=skipped)


def _import_transactions(
    session: Session,
    items: tuple[SourceTransaction, ...],
    mapping: Mapping[str, str],
) -> EntityImportResult:
    """Import transaction rows and count their idempotent outcomes."""
    inserted = updated = skipped = 0
    for item in items:
        currency = _require_currency(mapping, item.ticker)
        outcome = _upsert(
            session,
            TransactionRecord,
            item.source_id,
            _transaction_fields(item, currency),
        )
        if outcome == "inserted":
            inserted += 1
        elif outcome == "updated":
            updated += 1
        else:
            skipped += 1
    return EntityImportResult(inserted=inserted, updated=updated, skipped=skipped)


def _import_wishlist(
    session: Session, items: tuple[SourceWishlistItem, ...]
) -> EntityImportResult:
    """Import wishlist rows and count their idempotent outcomes."""
    inserted = updated = skipped = 0
    for item in items:
        outcome = _upsert(session, WishlistRecord, item.source_id, _wishlist_fields(item))
        if outcome == "inserted":
            inserted += 1
        elif outcome == "updated":
            updated += 1
        else:
            skipped += 1
    return EntityImportResult(inserted=inserted, updated=updated, skipped=skipped)


def _import_bibliography(
    session: Session, items: tuple[SourceBibliographyItem, ...]
) -> EntityImportResult:
    """Import bibliography rows and count their idempotent outcomes."""
    inserted = updated = skipped = 0
    for item in items:
        on_insert: dict[str, object] = {"added_at": item.added_at or datetime.now()}
        outcome = _upsert(
            session,
            BibliographyRecord,
            item.source_id,
            _bibliography_fields(item),
            on_insert=on_insert,
        )
        if outcome == "inserted":
            inserted += 1
        elif outcome == "updated":
            updated += 1
        else:
            skipped += 1
    return EntityImportResult(inserted=inserted, updated=updated, skipped=skipped)


def import_snapshot(
    session_factory: Callable[[], Session],
    snapshot: SourceSnapshot,
    currency_mapping: CurrencyMapping,
    validation_report: ValidationReport,
) -> ImportResult:
    """Import a validated snapshot into the destination in one transaction.

    Args:
        session_factory: A factory that opens an isolated destination session.
        snapshot: The read-only legacy data to import.
        currency_mapping: Explicit ``ticker -> currency`` mapping; never inferred.
        validation_report: The dry-run report; when not ``ready`` nothing is
            written and the returned :class:`ImportResult` reports
            ``committed=False``.

    Returns:
        Per-entity insert/update/skip/reject counters and the commit flag.

    Raises:
        Any destination error: the transaction is rolled back completely and
            the exception re-raised, leaving the destination unchanged.
    """
    mapping = normalize_currency_mapping(currency_mapping)
    if not validation_report.ready:
        return ImportResult(
            portfolio_items=EntityImportResult(
                rejected=_problem_count(validation_report, PORTFOLIO_ITEMS)
            ),
            transactions=EntityImportResult(
                rejected=_problem_count(validation_report, TRANSACTIONS)
            ),
            wishlist_items=EntityImportResult(
                rejected=_problem_count(validation_report, WISHLIST_ITEMS)
            ),
            bibliography_items=EntityImportResult(
                rejected=_problem_count(validation_report, BIBLIOGRAPHY_ITEMS)
            ),
            committed=False,
        )

    session = session_factory()
    try:
        portfolio = _import_portfolio(session, snapshot.portfolio_items, mapping)
        transactions = _import_transactions(session, snapshot.transactions, mapping)
        wishlist = _import_wishlist(session, snapshot.wishlist_items)
        bibliography = _import_bibliography(session, snapshot.bibliography_items)
        session.commit()
        return ImportResult(
            portfolio_items=portfolio,
            transactions=transactions,
            wishlist_items=wishlist,
            bibliography_items=bibliography,
            committed=True,
        )
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()