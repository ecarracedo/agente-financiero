"""Integration tests for the transactional, idempotent legacy import.

Every test builds a throwaway legacy SQLite copy and a throwaway destination
SQLite database under ``tmp_path``. The real ``finance.db`` is never opened,
copied, or modified here.
"""

from __future__ import annotations

import json
import sqlite3
from decimal import Decimal
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, func, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from backend.app.adapters.migration import (
    ImportNotReadyError,
    import_snapshot,
    read_source,
    reconcile,
    run_import,
    run_reconcile,
    validate_snapshot,
)
from backend.app.adapters.migration.__main__ import main
from backend.app.adapters.persistence.models import (
    Base,
    BibliographyRecord,
    PortfolioPositionRecord,
    TransactionRecord,
    WishlistRecord,
)

LEGACY_SCHEMA = """
CREATE TABLE "portfolioitem" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "ticker" VARCHAR(255) NOT NULL,
    "quantity" REAL NOT NULL,
    "category" VARCHAR(255) NOT NULL,
    "source_sheet" VARCHAR(255) NOT NULL,
    "broker" VARCHAR(255) NOT NULL,
    "avg_price" REAL NOT NULL,
    "target_price" REAL,
    "updated_at" DATETIME NOT NULL
);
CREATE TABLE "wishlistitem" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "ticker" VARCHAR(255) NOT NULL UNIQUE,
    "target_price" REAL,
    "added_at" DATETIME NOT NULL
);
CREATE TABLE "transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "ticker" VARCHAR(255) NOT NULL,
    "operation_type" VARCHAR(255) NOT NULL,
    "quantity" REAL NOT NULL,
    "price" REAL NOT NULL,
    "broker" VARCHAR(255) NOT NULL,
    "category" VARCHAR(255) NOT NULL
);
CREATE TABLE "bibliographyitem" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "year" INTEGER,
    "category" VARCHAR(255) NOT NULL,
    "link" VARCHAR(255),
    "description" TEXT,
    "added_at" DATETIME NOT NULL
);
"""


def build_legacy_db(
    path,
    *,
    portfolio=(),
    transactions=(),
    wishlist=(),
    bibliography=(),
):
    """Create a temporary legacy SQLite copy with explicit, stable ids."""
    connection = sqlite3.connect(path)
    try:
        connection.executescript(LEGACY_SCHEMA)
        connection.executemany(
            "INSERT INTO portfolioitem "
            "(id, ticker, quantity, category, source_sheet, broker, avg_price, target_price, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            portfolio,
        )
        connection.executemany(
            'INSERT INTO "transaction" '
            "(id, date, ticker, operation_type, quantity, price, broker, category) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            transactions,
        )
        connection.executemany(
            "INSERT INTO wishlistitem (id, ticker, target_price, added_at) VALUES (?, ?, ?, ?)",
            wishlist,
        )
        connection.executemany(
            "INSERT INTO bibliographyitem "
            "(id, title, author, year, category, link, description, added_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            bibliography,
        )
        connection.commit()
    finally:
        connection.close()
    return path


def portfolio_row(
    row_id=1,
    ticker="ALUA.BA",
    quantity=15.0,
    avg_price=984.0,
    target_price=1500.0,
    broker="Eco",
    category="Acciones",
):
    """Return a well-formed legacy portfolio row with an explicit id."""
    return (
        row_id,
        ticker,
        quantity,
        category,
        "Manual",
        broker,
        avg_price,
        target_price,
        "2025-12-17 20:21:46.696938",
    )


def transaction_row(
    row_id=1,
    ticker="ALUA.BA",
    operation_type="Compra",
    quantity=15.0,
    price=984.0,
    broker="Eco",
    category="Acciones",
    date="2025-05-27",
):
    """Return a well-formed legacy transaction row with an explicit id."""
    return (row_id, date, ticker, operation_type, quantity, price, broker, category)


def wishlist_row(row_id=1, ticker="GGAL.BA", target_price=500.0):
    """Return a well-formed legacy wishlist row with an explicit id."""
    return (row_id, ticker, target_price, "2025-06-01 10:00:00")


def bibliography_row(
    row_id=1,
    title="The Intelligent Investor",
    author="Benjamin Graham",
    year=1949,
    category="Value",
):
    """Return a well-formed legacy bibliography row with an explicit id."""
    return (row_id, title, author, year, category, None, None, "2025-06-01 10:00:00")


@pytest.fixture
def destination(tmp_path):
    """Provide a session factory bound to a throwaway destination database."""
    engine = create_engine(f"sqlite:///{tmp_path / 'destination.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    try:
        yield factory
    finally:
        engine.dispose()


def _validated(path, mapping):
    """Read and validate a legacy copy, returning snapshot and report."""
    snapshot = read_source(path)
    report = validate_snapshot(snapshot, mapping)
    return snapshot, report


def _count(session, model):
    """Return the number of rows for one destination model."""
    return session.scalar(select(func.count()).select_from(model))


def test_import_inserts_every_entity_with_mapping_and_source_ids(tmp_path, destination):
    """A ready import persists all entities, maps operations, and stores source ids."""
    source = build_legacy_db(
        tmp_path / "legacy.db",
        portfolio=[
            portfolio_row(1, "ALUA.BA", avg_price=984.0),
            portfolio_row(2, "GGAL.BA", quantity=5.0, avg_price=100.0),
        ],
        transactions=[
            transaction_row(1, "ALUA.BA", "Compra"),
            transaction_row(2, "ALUA.BA", "Venta", quantity=5.0, price=1050.0),
        ],
        wishlist=[wishlist_row(1, "GGAL.BA", 500.0)],
        bibliography=[bibliography_row(1)],
    )
    mapping = {"ALUA.BA": "ARS", "GGAL.BA": "ARS"}
    snapshot, report = _validated(source, mapping)
    assert report.ready is True

    result = import_snapshot(destination, snapshot, mapping, report)

    assert result.committed is True
    assert result.portfolio_items.inserted == 2
    assert result.transactions.inserted == 2
    assert result.wishlist_items.inserted == 1
    assert result.bibliography_items.inserted == 1
    assert result.portfolio_items.updated == 0
    assert result.portfolio_items.skipped == 0
    with destination() as session:
        assert _count(session, PortfolioPositionRecord) == 2
        assert _count(session, TransactionRecord) == 2
        assert _count(session, WishlistRecord) == 1
        assert _count(session, BibliographyRecord) == 1
        assert sorted(session.scalars(select(TransactionRecord.operation_type))) == [
            "BUY",
            "SELL",
        ]
        assert {row.currency for row in session.scalars(select(PortfolioPositionRecord))} == {
            "ARS"
        }
        assert {row.currency for row in session.scalars(select(TransactionRecord))} == {"ARS"}
        assert all(
            row.alert_intent is None
            for row in session.scalars(select(PortfolioPositionRecord))
        )
        assert all(
            row.alert_intent is None for row in session.scalars(select(WishlistRecord))
        )
        assert sorted(
            row.source_id for row in session.scalars(select(PortfolioPositionRecord))
        ) == [1, 2]
        assert sorted(
            row.source_id for row in session.scalars(select(TransactionRecord))
        ) == [1, 2]


def test_second_import_skips_every_row_without_duplicates(tmp_path, destination):
    """Re-importing the same source inserts nothing and duplicates nothing."""
    source = build_legacy_db(
        tmp_path / "legacy.db",
        portfolio=[portfolio_row(1)],
        transactions=[transaction_row(1)],
        wishlist=[wishlist_row(1)],
        bibliography=[bibliography_row(1)],
    )
    mapping = {"ALUA.BA": "ARS", "GGAL.BA": "ARS"}
    snapshot, report = _validated(source, mapping)
    first = import_snapshot(destination, snapshot, mapping, report)
    assert first.committed is True

    second = import_snapshot(destination, snapshot, mapping, report)

    assert second.committed is True
    assert second.portfolio_items.inserted == 0
    assert second.portfolio_items.skipped == 1
    assert second.transactions.inserted == 0
    assert second.transactions.skipped == 1
    assert second.wishlist_items.skipped == 1
    assert second.bibliography_items.skipped == 1
    with destination() as session:
        assert _count(session, PortfolioPositionRecord) == 1
        assert _count(session, TransactionRecord) == 1
        assert _count(session, WishlistRecord) == 1
        assert _count(session, BibliographyRecord) == 1


def test_float_values_quantize_to_ten_decimals_and_round_trip(tmp_path, destination):
    """Legacy floats become Decimals quantized to ten places, round-tripping."""
    source = build_legacy_db(
        tmp_path / "legacy.db",
        portfolio=[portfolio_row(1, "ALUA.BA", quantity=1.5, avg_price=123.45678901)],
        transactions=[transaction_row(1, "ALUA.BA", "Compra", quantity=1.5, price=123.45678901)],
    )
    mapping = {"ALUA.BA": "ARS"}
    snapshot, report = _validated(source, mapping)

    import_snapshot(destination, snapshot, mapping, report)

    with destination() as session:
        position = session.scalar(select(PortfolioPositionRecord))
        assert position.quantity == Decimal("1.5")
        assert position.average_price == Decimal("123.4567890100")
        transaction = session.scalar(select(TransactionRecord))
        assert transaction.quantity == Decimal("1.5")
        assert transaction.unit_price == Decimal("123.4567890100")


def test_not_ready_validation_does_not_touch_destination(tmp_path, destination):
    """A failing validation makes the importer leave the destination empty."""
    source = build_legacy_db(
        tmp_path / "legacy.db",
        portfolio=[portfolio_row(1, "ALUA.BA", quantity=-5.0)],
    )
    mapping = {"ALUA.BA": "ARS"}
    snapshot, report = _validated(source, mapping)
    assert report.ready is False

    result = import_snapshot(destination, snapshot, mapping, report)

    assert result.committed is False
    with destination() as session:
        assert _count(session, PortfolioPositionRecord) == 0
    with pytest.raises(ImportNotReadyError):
        run_import(destination, source, mapping)


def test_changed_source_row_is_updated_in_place_without_duplicate(tmp_path, destination):
    """A row whose source id already exists is updated, never duplicated."""
    mapping = {"ALUA.BA": "ARS"}
    original = build_legacy_db(
        tmp_path / "original.db",
        portfolio=[portfolio_row(1, "ALUA.BA", avg_price=984.0)],
    )
    snapshot, report = _validated(original, mapping)
    import_snapshot(destination, snapshot, mapping, report)

    changed = build_legacy_db(
        tmp_path / "changed.db",
        portfolio=[portfolio_row(1, "ALUA.BA", avg_price=1000.0)],
    )
    changed_snapshot, changed_report = _validated(changed, mapping)
    result = import_snapshot(destination, changed_snapshot, mapping, changed_report)

    assert result.portfolio_items.updated == 1
    assert result.portfolio_items.inserted == 0
    assert result.portfolio_items.skipped == 0
    with destination() as session:
        assert _count(session, PortfolioPositionRecord) == 1
        assert session.scalar(
            select(PortfolioPositionRecord.average_price)
        ) == Decimal("1000.0000000000")


def test_duplicate_destination_identity_rolls_back_whole_import(tmp_path, destination):
    """An integrity failure mid-import rolls back every entity write."""
    source = build_legacy_db(
        tmp_path / "legacy.db",
        portfolio=[portfolio_row(1, "ALUA.BA"), portfolio_row(2, "ALUA.BA")],
    )
    mapping = {"ALUA.BA": "ARS"}
    snapshot, report = _validated(source, mapping)
    assert report.ready is True

    with pytest.raises(IntegrityError):
        import_snapshot(destination, snapshot, mapping, report)

    with destination() as session:
        assert _count(session, PortfolioPositionRecord) == 0


def test_repeated_import_after_partial_import_only_adds_missing_rows(tmp_path, destination):
    """A second, larger import adds missing rows and skips already-present ones."""
    mapping = {"ALUA.BA": "ARS", "GGAL.BA": "ARS"}
    partial = build_legacy_db(
        tmp_path / "partial.db",
        portfolio=[portfolio_row(1, "ALUA.BA")],
    )
    partial_snapshot, partial_report = _validated(partial, mapping)
    import_snapshot(destination, partial_snapshot, mapping, partial_report)

    full = build_legacy_db(
        tmp_path / "full.db",
        portfolio=[
            portfolio_row(1, "ALUA.BA"),
            portfolio_row(2, "GGAL.BA", quantity=5.0, avg_price=100.0),
        ],
    )
    full_snapshot, full_report = _validated(full, mapping)
    result = import_snapshot(destination, full_snapshot, mapping, full_report)

    assert result.portfolio_items.inserted == 1
    assert result.portfolio_items.skipped == 1
    with destination() as session:
        assert _count(session, PortfolioPositionRecord) == 2


def test_reconciliation_matches_after_import(tmp_path, destination):
    """Reconciliation reports matched counts and balances after a full import."""
    source = build_legacy_db(
        tmp_path / "legacy.db",
        portfolio=[
            portfolio_row(1, "ALUA.BA", quantity=15.0, avg_price=984.0),
            portfolio_row(2, "GGAL.BA", quantity=5.0, avg_price=100.0),
        ],
        transactions=[
            transaction_row(1, "ALUA.BA", "Compra", quantity=15.0, price=984.0),
            transaction_row(2, "ALUA.BA", "Venta", quantity=5.0, price=1050.0),
        ],
        wishlist=[wishlist_row(1)],
        bibliography=[bibliography_row(1)],
    )
    mapping = {"ALUA.BA": "ARS", "GGAL.BA": "ARS"}
    snapshot, report = _validated(source, mapping)
    import_snapshot(destination, snapshot, mapping, report)

    reconciliation = run_reconcile(destination, source)

    assert reconciliation.matched is True
    portfolio = reconciliation.entities["portfolio_items"]
    assert portfolio.source_count == 2
    assert portfolio.destination_count == 2
    assert portfolio.source_balances["quantity"] == Decimal("20.0")
    transactions = reconciliation.entities["transactions"]
    assert transactions.source_count == 2
    assert transactions.source_balances["quantity"] == Decimal("20.0")
    assert transactions.source_balances["unit_price"] == Decimal("2034.0")


def test_reconciliation_reports_mismatch_before_import(tmp_path, destination):
    """Reconciliation before any import reports an explicit mismatch."""
    source = build_legacy_db(
        tmp_path / "legacy.db",
        portfolio=[portfolio_row(1)],
    )

    reconciliation = reconcile(destination, read_source(source))

    assert reconciliation.matched is False
    portfolio = reconciliation.entities["portfolio_items"]
    assert portfolio.source_count == 1
    assert portfolio.destination_count == 0


def test_a0003_migration_adds_and_removes_unique_source_ids(tmp_path):
    """The a0003 migration adds unique source-id indexes and reverses them."""
    project_root = Path(__file__).parents[2]
    config = Config(str(project_root / "backend" / "alembic.ini"))
    database_path = tmp_path / "migrated.db"
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")
    tables = [
        "portfolio_positions",
        "portfolio_transactions",
        "wishlist_items",
        "bibliography_items",
    ]

    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{database_path}")
    inspector = inspect(engine)
    for table in tables:
        columns = {column["name"] for column in inspector.get_columns(table)}
        assert "source_id" in columns
        unique_indexes = [
            index
            for index in inspector.get_indexes(table)
            if index["unique"] and index["column_names"] == ["source_id"]
        ]
        assert unique_indexes, f"missing unique source_id index on {table}"

    command.downgrade(config, "-1")

    inspector = inspect(engine)
    for table in tables:
        columns = {column["name"] for column in inspector.get_columns(table)}
        assert "source_id" not in columns
    engine.dispose()


def _empty_destination_url(tmp_path):
    """Create an empty destination SQLite database and return its URL."""
    database_path = tmp_path / "cli-destination.db"
    engine = create_engine(f"sqlite:///{database_path}")
    Base.metadata.create_all(engine)
    engine.dispose()
    return f"sqlite:///{database_path}"


def test_cli_dry_run_import_and_reconcile(tmp_path, capsys):
    """The CLI dry-run, import, and reconcile phases drive the full flow."""
    source = build_legacy_db(
        tmp_path / "legacy.db",
        portfolio=[portfolio_row(1)],
        transactions=[transaction_row(1)],
    )
    mapping_file = tmp_path / "currency.json"
    mapping_file.write_text(json.dumps({"ALUA.BA": "ARS"}))
    database_url = _empty_destination_url(tmp_path)

    assert (
        main(
            [
                "dry-run",
                "--source",
                str(source),
                "--currency-map",
                str(mapping_file),
            ]
        )
        == 0
    )
    assert '"ready": true' in capsys.readouterr().out

    assert (
        main(
            [
                "import",
                "--source",
                str(source),
                "--currency-map",
                str(mapping_file),
                "--database-url",
                database_url,
            ]
        )
        == 0
    )
    assert '"inserted": 2' in capsys.readouterr().out

    assert (
        main(
            ["reconcile", "--source", str(source), "--database-url", database_url]
        )
        == 0
    )
    assert "matched: True" in capsys.readouterr().out


def test_cli_dry_run_flag_prevents_import(tmp_path):
    """The --dry-run flag forces a read-only run and never writes the destination."""
    source = build_legacy_db(tmp_path / "legacy.db", portfolio=[portfolio_row(1)])
    mapping_file = tmp_path / "currency.json"
    mapping_file.write_text(json.dumps({"ALUA.BA": "ARS"}))
    database_url = _empty_destination_url(tmp_path)

    assert (
        main(
            [
                "import",
                "--source",
                str(source),
                "--currency-map",
                str(mapping_file),
                "--database-url",
                database_url,
                "--dry-run",
            ]
        )
        == 0
    )

    engine = create_engine(database_url)
    with sessionmaker(bind=engine)() as session:
        assert _count(session, PortfolioPositionRecord) == 0
    engine.dispose()
