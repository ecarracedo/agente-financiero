"""Migration orchestration: dry-run, transactional import, and reconciliation.

The runner composes the read-only source reader, the pure validator, the
transactional importer, and a source-versus-destination reconciliation report
into the command surface used by the CLI and by migration rehearsals.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.adapters.persistence.models import (
    BibliographyRecord,
    PortfolioPositionRecord,
    TransactionRecord,
    WishlistRecord,
)

from .importer import ImportNotReadyError, import_snapshot, to_decimal
from .report import (
    EntityReconciliation,
    ImportResult,
    ReconciliationReport,
    ValidationReport,
)
from .source import SourceSnapshot, read_source
from .validation import (
    BIBLIOGRAPHY_ITEMS,
    PORTFOLIO_ITEMS,
    TRANSACTIONS,
    WISHLIST_ITEMS,
    CurrencyMapping,
    validate_snapshot,
)


@dataclass(frozen=True)
class MigrationRunResult:
    """Full migration run: validation, import, and reconciliation outcome."""

    validation: ValidationReport
    import_result: ImportResult | None = None
    reconciliation: ReconciliationReport | None = None


def _source_balances(
    snapshot: SourceSnapshot,
) -> dict[str, dict[str, Decimal]]:
    """Compute per-entity source counts and monetary balances.

    Balances aggregate legacy floats through the same string-based Decimal
    conversion the importer uses, so reconciliation compares like with like.
    """
    return {
        PORTFOLIO_ITEMS: {
            "quantity": sum(
                (to_decimal(item.quantity) for item in snapshot.portfolio_items),
                start=Decimal(0),
            ),
            "average_price": sum(
                (to_decimal(item.avg_price) for item in snapshot.portfolio_items),
                start=Decimal(0),
            ),
        },
        TRANSACTIONS: {
            "quantity": sum(
                (to_decimal(item.quantity) for item in snapshot.transactions),
                start=Decimal(0),
            ),
            "unit_price": sum(
                (to_decimal(item.price) for item in snapshot.transactions),
                start=Decimal(0),
            ),
        },
        WISHLIST_ITEMS: {},
        BIBLIOGRAPHY_ITEMS: {},
    }


def _destination_counts_and_balances(
    session: Session,
) -> dict[str, tuple[int, dict[str, Decimal]]]:
    """Compute per-entity destination row counts and monetary balances."""
    records = list(session.scalars(select(PortfolioPositionRecord)))
    transactions = list(session.scalars(select(TransactionRecord)))
    return {
        PORTFOLIO_ITEMS: (
            len(records),
            {
                "quantity": sum(
                    (record.quantity for record in records), start=Decimal(0)
                ),
                "average_price": sum(
                    (record.average_price for record in records), start=Decimal(0)
                ),
            },
        ),
        TRANSACTIONS: (
            len(transactions),
            {
                "quantity": sum(
                    (record.quantity for record in transactions), start=Decimal(0)
                ),
                "unit_price": sum(
                    (record.unit_price for record in transactions), start=Decimal(0)
                ),
            },
        ),
        WISHLIST_ITEMS: (
            len(list(session.scalars(select(WishlistRecord)))),
            {},
        ),
        BIBLIOGRAPHY_ITEMS: (
            len(list(session.scalars(select(BibliographyRecord)))),
            {},
        ),
    }


def reconcile(
    session_factory: Callable[[], Session],
    snapshot: SourceSnapshot,
) -> ReconciliationReport:
    """Compare source rows and balances against the destination state.

    The comparison is read-only: it never writes to the destination.
    """
    source_counts = {
        PORTFOLIO_ITEMS: len(snapshot.portfolio_items),
        TRANSACTIONS: len(snapshot.transactions),
        WISHLIST_ITEMS: len(snapshot.wishlist_items),
        BIBLIOGRAPHY_ITEMS: len(snapshot.bibliography_items),
    }
    source_balances = _source_balances(snapshot)
    session = session_factory()
    try:
        destination = _destination_counts_and_balances(session)
    finally:
        session.close()
    entities = {
        entity: EntityReconciliation(
            entity=entity,
            source_count=source_counts[entity],
            destination_count=destination[entity][0],
            source_balances=source_balances[entity],
            destination_balances=destination[entity][1],
        )
        for entity in (
            PORTFOLIO_ITEMS,
            TRANSACTIONS,
            WISHLIST_ITEMS,
            BIBLIOGRAPHY_ITEMS,
        )
    }
    return ReconciliationReport(entities=entities)


def run_dry_run(source_path: str | Path, currency_mapping: CurrencyMapping) -> ValidationReport:
    """Read and validate a legacy copy without touching any destination."""
    return validate_snapshot(read_source(source_path), currency_mapping)


def run_import(
    session_factory: Callable[[], Session],
    source_path: str | Path,
    currency_mapping: CurrencyMapping,
) -> ImportResult:
    """Dry-run then import a legacy copy atomically.

    Raises:
        ImportNotReadyError: When the dry-run report is not ready; the
            destination is left untouched.
    """
    snapshot = read_source(source_path)
    validation = validate_snapshot(snapshot, currency_mapping)
    if not validation.ready:
        raise ImportNotReadyError(
            "import blocked: validation is not ready "
            f"({len(validation.rejected)} rejected, "
            f"{len(validation.unresolved_currency)} unresolved currency rows)"
        )
    return import_snapshot(session_factory, snapshot, currency_mapping, validation)


def run_reconcile(
    session_factory: Callable[[], Session], source_path: str | Path
) -> ReconciliationReport:
    """Read a legacy copy and reconcile it against the destination."""
    return reconcile(session_factory, read_source(source_path))


def run_migration(
    session_factory: Callable[[], Session],
    source_path: str | Path,
    currency_mapping: CurrencyMapping,
) -> MigrationRunResult:
    """Orchestrate dry-run, import, and reconciliation in one run.

    When validation is not ready the run stops before importing; the result
    carries the failing validation report and no import or reconciliation.
    """
    snapshot = read_source(source_path)
    validation = validate_snapshot(snapshot, currency_mapping)
    if not validation.ready:
        return MigrationRunResult(validation=validation)
    import_result = import_snapshot(
        session_factory, snapshot, currency_mapping, validation
    )
    reconciliation = reconcile(session_factory, snapshot)
    return MigrationRunResult(
        validation=validation,
        import_result=import_result,
        reconciliation=reconciliation,
    )


def format_mismatch_detail(report: ReconciliationReport) -> str:
    """Render a human-readable reconciliation summary for reports and CLI."""
    lines = [f"reconciliation matched: {report.matched}"]
    for entity, entry in report.entities.items():
        lines.append(
            f"  {entity}: source={entry.source_count} destination={entry.destination_count} "
            f"matched={entry.matched}"
        )
    return "\n".join(lines)