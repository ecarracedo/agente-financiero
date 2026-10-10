"""Read-only dry-run migration tooling for the legacy SQLite database.

This package reads a preserved copy of ``finance.db`` without ever writing to
it and validates the data before any destination import. It is intentionally
side-effect free: no destination is touched and currency is only ever taken
from an explicit mapping.
"""

from .report import RejectedRow, UnresolvedCurrencyRow, ValidationReport
from .source import (
    SourceBibliographyItem,
    SourceNotFoundError,
    SourcePortfolioItem,
    SourceSnapshot,
    SourceTransaction,
    SourceWishlistItem,
    open_read_only_connection,
    read_source,
)
from .validation import (
    BIBLIOGRAPHY_ITEMS,
    PORTFOLIO_ITEMS,
    TRANSACTIONS,
    VALID_OPERATION_TYPES,
    WISHLIST_ITEMS,
    CurrencyMapping,
    load_currency_mapping,
    normalize_currency_mapping,
    validate_snapshot,
)

__all__ = [
    "BIBLIOGRAPHY_ITEMS",
    "PORTFOLIO_ITEMS",
    "TRANSACTIONS",
    "VALID_OPERATION_TYPES",
    "WISHLIST_ITEMS",
    "CurrencyMapping",
    "RejectedRow",
    "SourceBibliographyItem",
    "SourceNotFoundError",
    "SourcePortfolioItem",
    "SourceSnapshot",
    "SourceTransaction",
    "SourceWishlistItem",
    "UnresolvedCurrencyRow",
    "ValidationReport",
    "load_currency_mapping",
    "normalize_currency_mapping",
    "open_read_only_connection",
    "read_source",
    "validate_snapshot",
]
