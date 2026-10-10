"""Tests for the read-only legacy SQLite source reader and dry-run validator.

Every test builds its own temporary legacy SQLite database under ``tmp_path``;
the real ``finance.db`` is never opened or copied here.
"""

import hashlib
import json
import sqlite3
from datetime import datetime

import pytest

from backend.app.adapters.migration import (
    CurrencyMapping,
    RejectedRow,
    SourceNotFoundError,
    UnresolvedCurrencyRow,
    ValidationReport,
    load_currency_mapping,
    open_read_only_connection,
    read_source,
    validate_snapshot,
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
    """Create a temporary legacy SQLite copy with the authoritative schema."""
    connection = sqlite3.connect(path)
    connection.executescript(LEGACY_SCHEMA)
    connection.executemany(
        "INSERT INTO portfolioitem "
        "(ticker, quantity, category, source_sheet, broker, avg_price, target_price, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        portfolio,
    )
    connection.executemany(
        "INSERT INTO wishlistitem (ticker, target_price, added_at) VALUES (?, ?, ?)",
        wishlist,
    )
    connection.executemany(
        'INSERT INTO "transaction" '
        "(date, ticker, operation_type, quantity, price, broker, category) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        transactions,
    )
    connection.executemany(
        "INSERT INTO bibliographyitem "
        "(title, author, year, category, link, description, added_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        bibliography,
    )
    connection.commit()
    connection.close()
    return path


def valid_portfolio_row(ticker="ALUA.BA", target_price=1500.0):
    """Return a well-formed legacy portfolio row."""
    return (ticker, 15.0, "Acciones", "Manual", "Eco", 984.0, target_price, "2025-12-17 20:21:46.696938")


def valid_transaction_row(ticker="ALUA.BA", operation_type="Compra"):
    """Return a well-formed legacy transaction row."""
    return ("2025-05-27", ticker, operation_type, 15.0, 984.0, "Eco", "Acciones")


@pytest.fixture
def legacy_db(tmp_path):
    """Provide a populated temporary legacy database path."""
    path = tmp_path / "legacy.db"
    return build_legacy_db(
        path,
        portfolio=[valid_portfolio_row()],
        transactions=[valid_transaction_row()],
    )


def test_read_source_returns_typed_snapshot(legacy_db):
    """The reader maps every legacy table into a typed snapshot."""
    snapshot = read_source(legacy_db)

    assert len(snapshot.portfolio_items) == 1
    assert len(snapshot.transactions) == 1
    assert snapshot.portfolio_items[0].ticker == "ALUA.BA"
    assert snapshot.portfolio_items[0].avg_price == pytest.approx(984.0)
    assert snapshot.transactions[0].operation_type == "Compra"
    assert snapshot.transactions[0].date == datetime(2025, 5, 27)


def test_read_source_does_not_modify_source_bytes(legacy_db):
    """Reading the source leaves the underlying file byte-identical."""
    before = hashlib.sha256(legacy_db.read_bytes()).hexdigest()

    read_source(legacy_db)

    after = hashlib.sha256(legacy_db.read_bytes()).hexdigest()
    assert before == after


def test_validate_ready_when_valid_and_mapped(legacy_db):
    """A fully valid, fully mapped snapshot is ready with zero problems."""
    snapshot = read_source(legacy_db)
    mapping: CurrencyMapping = {"ALUA.BA": "ARS"}

    report = validate_snapshot(snapshot, mapping)

    assert isinstance(report, ValidationReport)
    assert report.counts == {
        "portfolio_items": 1,
        "transactions": 1,
        "wishlist_items": 0,
        "bibliography_items": 0,
    }
    assert report.rejected == ()
    assert report.unresolved_currency == ()
    assert report.ready is True


def test_zero_rows_snapshot_is_ready(tmp_path):
    """An empty source with no rows is trivially ready."""
    path = build_legacy_db(tmp_path / "empty.db")

    report = validate_snapshot(read_source(path), {})

    assert report.ready is True
    assert report.counts["portfolio_items"] == 0


def test_invalid_numeric_value_is_rejected(tmp_path):
    """A non-positive quantity rejects the portfolio row."""
    path = build_legacy_db(
        tmp_path / "invalid.db",
        portfolio=[("ALUA.BA", -5.0, "Acciones", "Manual", "Eco", 984.0, None, "2025-12-17 20:21:46")],
    )

    report = validate_snapshot(read_source(path), {"ALUA.BA": "ARS"})

    assert report.ready is False
    assert any(row.entity == "portfolio_items" and "quantity" in row.reason for row in report.rejected)


def test_null_target_price_is_allowed(tmp_path):
    """A NULL legacy target_price is accepted, not rejected."""
    path = build_legacy_db(
        tmp_path / "null-target.db",
        portfolio=[valid_portfolio_row(target_price=None)],
    )

    report = validate_snapshot(read_source(path), {"ALUA.BA": "ARS"})

    assert report.rejected == ()
    assert report.ready is True


def test_unknown_operation_type_is_rejected(tmp_path):
    """An operation_type outside Compra/Venta is rejected with a reason."""
    path = build_legacy_db(
        tmp_path / "unknown-op.db",
        transactions=[valid_transaction_row(operation_type="Transferencia")],
    )

    report = validate_snapshot(read_source(path), {"ALUA.BA": "ARS"})

    assert report.ready is False
    rejected = [row for row in report.rejected if row.entity == "transactions"]
    assert len(rejected) == 1
    assert "operation_type" in rejected[0].reason


def test_unparsable_date_is_rejected(tmp_path):
    """A transaction date that cannot be parsed is rejected."""
    path = build_legacy_db(
        tmp_path / "bad-date.db",
        transactions=[("not-a-date", "ALUA.BA", "Compra", 15.0, 984.0, "Eco", "Acciones")],
    )

    report = validate_snapshot(read_source(path), {"ALUA.BA": "ARS"})

    assert report.ready is False
    assert any(row.entity == "transactions" and "date" in row.reason for row in report.rejected)


def test_missing_required_identity_field_is_rejected(tmp_path):
    """An empty required broker field rejects the transaction."""
    path = build_legacy_db(
        tmp_path / "missing-field.db",
        transactions=[("2025-05-27", "ALUA.BA", "Compra", 15.0, 984.0, "", "Acciones")],
    )

    report = validate_snapshot(read_source(path), {"ALUA.BA": "ARS"})

    assert report.ready is False
    assert any(row.entity == "transactions" and "broker" in row.reason for row in report.rejected)


def test_unmapped_currency_is_unresolved_and_not_ready(tmp_path):
    """A monetary row whose ticker has no mapping is reported unresolved."""
    path = build_legacy_db(
        tmp_path / "unmapped.db",
        portfolio=[valid_portfolio_row(ticker="ZZZ.BA")],
    )

    report = validate_snapshot(read_source(path), {"ALUA.BA": "ARS"})

    assert report.ready is False
    assert report.rejected == ()
    unresolved = [row for row in report.unresolved_currency if row.entity == "portfolio_items"]
    assert len(unresolved) == 1
    assert unresolved[0].ticker == "ZZZ.BA"
    assert isinstance(report.unresolved_currency[0], UnresolvedCurrencyRow)


def test_currency_mapping_is_case_insensitive(tmp_path):
    """Ticker lookup normalizes both the mapping and the source ticker."""
    path = build_legacy_db(
        tmp_path / "case.db",
        portfolio=[valid_portfolio_row(ticker="ALUA.BA")],
    )

    report = validate_snapshot(read_source(path), {"alua.ba": "ars"})

    assert report.unresolved_currency == ()
    assert report.ready is True


def test_missing_source_file_raises(tmp_path):
    """Opening an absent source raises a clear error instead of failing obscurely."""
    with pytest.raises(SourceNotFoundError):
        read_source(tmp_path / "does-not-exist.db")


def test_read_only_connection_rejects_writes(legacy_db):
    """The reader opens the copy in mode=ro, so writes must fail."""
    connection = open_read_only_connection(legacy_db)
    try:
        with pytest.raises(sqlite3.OperationalError, match="readonly|read-only"):
            connection.execute(
                "INSERT INTO portfolioitem "
                "(ticker, quantity, category, source_sheet, broker, avg_price, updated_at) "
                "VALUES ('X', 1, 'Acciones', 'Manual', 'Eco', 1, '2025-01-01')"
            )
    finally:
        connection.close()


def test_load_currency_mapping_from_json(tmp_path):
    """A JSON mapping file is loaded with upper-cased ticker keys."""
    mapping_file = tmp_path / "currency.json"
    mapping_file.write_text(json.dumps({"alua.ba": "ARS", "BYMA.BA": "USD"}))

    mapping = load_currency_mapping(mapping_file)

    assert mapping == {"ALUA.BA": "ARS", "BYMA.BA": "USD"}


def test_rejected_row_identifier_is_human_readable(tmp_path):
    """Rejected rows expose the offending ticker as their identifier."""
    path = build_legacy_db(
        tmp_path / "identifier.db",
        portfolio=[("ALUA.BA", 0.0, "Acciones", "Manual", "Eco", 984.0, None, "2025-12-17")],
    )

    report = validate_snapshot(read_source(path), {"ALUA.BA": "ARS"})

    assert isinstance(report.rejected[0], RejectedRow)
    assert report.rejected[0].identifier == "ALUA.BA"
