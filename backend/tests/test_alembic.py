"""Tests for Alembic schema initialization."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_upgrade_creates_initial_financial_schema(tmp_path):
    """Alembic creates every initial table in a clean database."""
    project_root = Path(__file__).parents[2]
    config = Config(str(project_root / "backend" / "alembic.ini"))
    database_path = tmp_path / "financial-agent.db"
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")

    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{database_path}")
    tables = set(inspect(engine).get_table_names())
    engine.dispose()

    assert {
        "portfolio_positions",
        "portfolio_transactions",
        "wishlist_items",
        "bibliography_items",
        "alembic_version",
    } <= tables


def test_database_url_environment_overrides_ini_url(tmp_path, monkeypatch):
    """Alembic migrates the environment-configured database, not its fallback."""
    project_root = Path(__file__).parents[2]
    config = Config(str(project_root / "backend" / "alembic.ini"))
    configured_database = tmp_path / "configured.db"
    environment_database = tmp_path / "environment.db"
    config.set_main_option("sqlalchemy.url", f"sqlite:///{configured_database}")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{environment_database}")

    command.upgrade(config, "head")

    assert environment_database.exists()
    engine = create_engine(f"sqlite:///{environment_database}")
    tables = set(inspect(engine).get_table_names())
    engine.dispose()
    assert "portfolio_positions" in tables
    assert not configured_database.exists()


def test_upgrade_adds_persistent_target_alert_settings(tmp_path):
    """The schema stores target intent and quote state for each alert target."""
    project_root = Path(__file__).parents[2]
    config = Config(str(project_root / "backend" / "alembic.ini"))
    database_path = tmp_path / "alert-settings.db"
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")

    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{database_path}")
    inspector = inspect(engine)
    position_columns = {column["name"] for column in inspector.get_columns("portfolio_positions")}
    wishlist_columns = {column["name"] for column in inspector.get_columns("wishlist_items")}
    engine.dispose()

    assert {"target_price", "alert_intent", "last_observed_price"} <= position_columns
    assert {"alert_intent", "last_observed_price"} <= wishlist_columns
