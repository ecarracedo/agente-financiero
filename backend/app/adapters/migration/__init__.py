"""Read-only dry-run migration tooling for the legacy SQLite database.

This package reads a preserved copy of ``finance.db`` without ever writing to
it, validates the data, imports a validated snapshot into the destination in
one atomic, idempotent transaction keyed on legacy ``source_id`` rows, and
reconciles source versus destination afterwards. Currency is only ever taken
from an explicit mapping.
"""

from .importer import (
    OPERATION_TYPE_MAP,
    ImportNotReadyError,
    import_snapshot,
    to_decimal,
    to_optional_decimal,
)
from .report import (
    EntityImportResult,
    EntityReconciliation,
    ImportResult,
    ReconciliationReport,
    RejectedRow,
    UnresolvedCurrencyRow,
    ValidationReport,
)
from .runner import (
    MigrationRunResult,
    format_mismatch_detail,
    reconcile,
    run_dry_run,
    run_import,
    run_migration,
    run_reconcile,
)
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
    "EntityImportResult",
    "EntityReconciliation",
    "ImportNotReadyError",
    "ImportResult",
    "MigrationRunResult",
    "OPERATION_TYPE_MAP",
    "ReconciliationReport",
    "RejectedRow",
    "SourceBibliographyItem",
    "SourceNotFoundError",
    "SourcePortfolioItem",
    "SourceSnapshot",
    "SourceTransaction",
    "SourceWishlistItem",
    "UnresolvedCurrencyRow",
    "ValidationReport",
    "format_mismatch_detail",
    "import_snapshot",
    "load_currency_mapping",
    "normalize_currency_mapping",
    "open_read_only_connection",
    "read_source",
    "reconcile",
    "run_dry_run",
    "run_import",
    "run_migration",
    "run_reconcile",
    "to_decimal",
    "to_optional_decimal",
    "validate_snapshot",
]