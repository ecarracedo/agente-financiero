"""Validation rules for the legacy SQLite dry-run.

Validation is pure: it inspects an already-read :class:`SourceSnapshot` and an
explicit currency mapping, then returns a :class:`ValidationReport`. It never
writes to the source or any destination, and it NEVER infers currency.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path

from .report import RejectedRow, UnresolvedCurrencyRow, ValidationReport
from .source import (
    SourcePortfolioItem,
    SourceSnapshot,
    SourceTransaction,
    SourceWishlistItem,
)

CurrencyMapping = Mapping[str, str]

PORTFOLIO_ITEMS = "portfolio_items"
TRANSACTIONS = "transactions"
WISHLIST_ITEMS = "wishlist_items"
BIBLIOGRAPHY_ITEMS = "bibliography_items"

VALID_OPERATION_TYPES = frozenset({"Compra", "Venta"})

UNRESOLVED_CURRENCY_REASON = "no explicit currency mapping for ticker"


def normalize_currency_mapping(currency_mapping: CurrencyMapping) -> dict[str, str]:
    """Return a copy of the mapping with stripped, upper-cased ticker keys."""
    return {
        str(ticker).strip().upper(): str(currency)
        for ticker, currency in currency_mapping.items()
        if str(ticker).strip()
    }


def load_currency_mapping(path: str | Path) -> dict[str, str]:
    """Load a JSON ``{ticker: currency}`` file into a normalized mapping."""
    raw_mapping = json.loads(Path(path).read_text())
    if not isinstance(raw_mapping, dict):
        raise ValueError("currency mapping file must contain a JSON object")
    return normalize_currency_mapping(raw_mapping)


def _identifier(ticker: str, index: int) -> str:
    """Return a human-readable identifier for a rejected or unresolved row."""
    return ticker or f"#{index}"


def _validate_portfolio_items(
    items: tuple[SourcePortfolioItem, ...],
    mapping: Mapping[str, str],
    rejected: list[RejectedRow],
    unresolved: list[UnresolvedCurrencyRow],
) -> None:
    """Validate portfolio rows and append any rejection/unresolved findings."""
    for index, item in enumerate(items):
        identifier = _identifier(item.ticker, index)
        if not item.ticker:
            rejected.append(RejectedRow(PORTFOLIO_ITEMS, identifier, "missing required field: ticker"))
        if not item.category:
            rejected.append(RejectedRow(PORTFOLIO_ITEMS, identifier, "missing required field: category"))
        if not item.broker:
            rejected.append(RejectedRow(PORTFOLIO_ITEMS, identifier, "missing required field: broker"))
        if item.quantity <= 0:
            rejected.append(RejectedRow(PORTFOLIO_ITEMS, identifier, "quantity must be positive"))
        if item.avg_price <= 0:
            rejected.append(RejectedRow(PORTFOLIO_ITEMS, identifier, "avg_price must be positive"))
        if item.ticker and item.ticker.strip().upper() not in mapping:
            unresolved.append(UnresolvedCurrencyRow(PORTFOLIO_ITEMS, item.ticker, UNRESOLVED_CURRENCY_REASON))


def _validate_transactions(
    items: tuple[SourceTransaction, ...],
    mapping: Mapping[str, str],
    rejected: list[RejectedRow],
    unresolved: list[UnresolvedCurrencyRow],
) -> None:
    """Validate transaction rows and append any rejection/unresolved findings."""
    for index, item in enumerate(items):
        identifier = _identifier(item.ticker, index)
        if not item.ticker:
            rejected.append(RejectedRow(TRANSACTIONS, identifier, "missing required field: ticker"))
        if not item.broker:
            rejected.append(RejectedRow(TRANSACTIONS, identifier, "missing required field: broker"))
        if not item.category:
            rejected.append(RejectedRow(TRANSACTIONS, identifier, "missing required field: category"))
        if item.date_error is not None:
            rejected.append(RejectedRow(TRANSACTIONS, identifier, f"unparsable date: {item.date_error}"))
        elif item.date is None:
            rejected.append(RejectedRow(TRANSACTIONS, identifier, "missing required field: date"))
        if item.operation_type not in VALID_OPERATION_TYPES:
            rejected.append(
                RejectedRow(TRANSACTIONS, identifier, f"invalid operation_type: {item.operation_type!r}")
            )
        if item.quantity <= 0:
            rejected.append(RejectedRow(TRANSACTIONS, identifier, "quantity must be positive"))
        if item.price <= 0:
            rejected.append(RejectedRow(TRANSACTIONS, identifier, "price must be positive"))
        if item.ticker and item.ticker.strip().upper() not in mapping:
            unresolved.append(UnresolvedCurrencyRow(TRANSACTIONS, item.ticker, UNRESOLVED_CURRENCY_REASON))


def _validate_wishlist_items(
    items: tuple[SourceWishlistItem, ...],
    mapping: Mapping[str, str],
    rejected: list[RejectedRow],
    unresolved: list[UnresolvedCurrencyRow],
) -> None:
    """Validate wishlist rows and append any rejection/unresolved findings."""
    for index, item in enumerate(items):
        identifier = _identifier(item.ticker, index)
        if not item.ticker:
            rejected.append(RejectedRow(WISHLIST_ITEMS, identifier, "missing required field: ticker"))
        has_monetary_value = item.target_price is not None
        if has_monetary_value and item.ticker and item.ticker.strip().upper() not in mapping:
            unresolved.append(UnresolvedCurrencyRow(WISHLIST_ITEMS, item.ticker, UNRESOLVED_CURRENCY_REASON))


def _validate_bibliography_items(
    snapshot: SourceSnapshot,
    rejected: list[RejectedRow],
) -> None:
    """Validate bibliography rows (no monetary columns, no currency needed)."""
    for index, item in enumerate(snapshot.bibliography_items):
        identifier = item.title or f"#{index}"
        if not item.title:
            rejected.append(RejectedRow(BIBLIOGRAPHY_ITEMS, identifier, "missing required field: title"))
        if not item.author:
            rejected.append(RejectedRow(BIBLIOGRAPHY_ITEMS, identifier, "missing required field: author"))
        if not item.category:
            rejected.append(RejectedRow(BIBLIOGRAPHY_ITEMS, identifier, "missing required field: category"))


def validate_snapshot(
    snapshot: SourceSnapshot,
    currency_mapping: CurrencyMapping,
) -> ValidationReport:
    """Validate a snapshot against explicit rules and a currency mapping.

    Args:
        snapshot: The read-only legacy data to validate.
        currency_mapping: Explicit ``ticker -> currency`` mapping. Rows whose
            ticker is absent are reported as unresolved; currency is never
            inferred.

    Returns:
        A :class:`ValidationReport` whose ``ready`` flag is True only when no
        row is rejected and no currency is unresolved.
    """
    mapping = normalize_currency_mapping(currency_mapping)
    rejected: list[RejectedRow] = []
    unresolved: list[UnresolvedCurrencyRow] = []

    _validate_portfolio_items(snapshot.portfolio_items, mapping, rejected, unresolved)
    _validate_transactions(snapshot.transactions, mapping, rejected, unresolved)
    _validate_wishlist_items(snapshot.wishlist_items, mapping, rejected, unresolved)
    _validate_bibliography_items(snapshot, rejected)

    counts = {
        PORTFOLIO_ITEMS: len(snapshot.portfolio_items),
        TRANSACTIONS: len(snapshot.transactions),
        WISHLIST_ITEMS: len(snapshot.wishlist_items),
        BIBLIOGRAPHY_ITEMS: len(snapshot.bibliography_items),
    }
    return ValidationReport(
        counts=counts,
        rejected=tuple(rejected),
        unresolved_currency=tuple(unresolved),
    )
