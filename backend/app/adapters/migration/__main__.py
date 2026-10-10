"""Command-line interface for the legacy SQLite migration flow.

Usage:
    python -m backend.app.adapters.migration dry-run --source legacy.db --currency-map mapping.json
    python -m backend.app.adapters.migration import --source legacy.db --currency-map mapping.json --database-url <URL>
    python -m backend.app.adapters.migration reconcile --source legacy.db --database-url <URL>

``--dry-run`` turns any subcommand into a read-only dry run. Exit code is 0 on
success (or a ready dry run) and 1 when validation is not ready or
reconciliation does not match.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Callable, Sequence
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from backend.app.adapters.persistence.database import create_database_engine

from .importer import ImportNotReadyError
from .report import ImportResult, ReconciliationReport, ValidationReport
from .runner import (
    format_mismatch_detail,
    run_dry_run,
    run_import,
    run_reconcile,
)
from .validation import CurrencyMapping, load_currency_mapping


def build_parser() -> argparse.ArgumentParser:
    """Build the migration CLI argument parser."""
    parser = argparse.ArgumentParser(
        prog="python -m backend.app.adapters.migration",
        description="Dry-run, import, and reconcile the legacy SQLite database.",
    )
    parser.add_argument(
        "command",
        choices=("dry-run", "import", "reconcile"),
        help="migration phase to execute",
    )
    parser.add_argument(
        "--source", required=True, help="path to the preserved legacy SQLite copy"
    )
    parser.add_argument(
        "--currency-map",
        help="path to a JSON {ticker: currency} mapping (required for dry-run/import)",
    )
    parser.add_argument(
        "--database-url",
        help="destination SQLAlchemy URL (required for import/reconcile)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        dest="dry_run_only",
        help="only run the read-only dry-run and report readiness",
    )
    return parser


def _load_mapping(path: str | None) -> CurrencyMapping:
    """Load and normalize the explicit currency mapping file."""
    if not path:
        raise SystemExit("--currency-map is required for this command")
    return load_currency_mapping(path)


def _session_factory(database_url: str | None) -> Callable[[], Session]:
    """Build a session factory from an explicit destination URL."""
    if not database_url:
        raise SystemExit("--database-url is required for this command")
    engine = create_database_engine(database_url)
    return sessionmaker(bind=engine)


def _print_validation(report: ValidationReport) -> None:
    """Render the dry-run validation report to stdout."""
    print(json.dumps({"ready": report.ready, "counts": dict(report.counts)}))
    for rejected in report.rejected:
        print(f"REJECTED {rejected.entity} {rejected.identifier}: {rejected.reason}")
    for unresolved in report.unresolved_currency:
        print(
            f"UNRESOLVED {unresolved.entity} {unresolved.ticker}: {unresolved.reason}"
        )


def _print_import(result: ImportResult) -> None:
    """Render the import result to stdout."""
    print(
        json.dumps(
            {
                "committed": result.committed,
                "inserted": result.inserted_total,
                "updated": result.updated_total,
                "skipped": result.skipped_total,
            }
        )
    )


def _print_reconciliation(report: ReconciliationReport) -> None:
    """Render the reconciliation report to stdout."""
    print(format_mismatch_detail(report))


def main(argv: Sequence[str] | None = None) -> int:
    """Parse arguments and run the selected migration phase."""
    args = build_parser().parse_args(argv)
    command = "dry-run" if args.dry_run_only else args.command

    if command == "dry-run":
        mapping = _load_mapping(args.currency_map)
        dry_run = run_dry_run(Path(args.source), mapping)
        _print_validation(dry_run)
        return 0 if dry_run.ready else 1

    if command == "import":
        mapping = _load_mapping(args.currency_map)
        factory = _session_factory(args.database_url)
        try:
            result = run_import(factory, Path(args.source), mapping)
        except ImportNotReadyError as error:
            print(f"IMPORT BLOCKED: {error}")
            return 1
        _print_import(result)
        return 0

    if command == "reconcile":
        factory = _session_factory(args.database_url)
        reconciliation = run_reconcile(factory, Path(args.source))
        _print_reconciliation(reconciliation)
        return 0 if reconciliation.matched else 1

    return 2


if __name__ == "__main__":
    raise SystemExit(main())