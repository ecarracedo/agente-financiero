"""Alembic environment for SQLAlchemy schema migrations."""

import os

from alembic import context
from sqlalchemy import engine_from_config, pool

from backend.app.adapters.persistence.database import (
    require_database_url,
    resolve_database_url,
)
from backend.app.adapters.persistence.models import Base

config = context.config
target_metadata = Base.metadata


def _database_url() -> str:
    """Resolve the migration URL from runtime environment or Alembic config."""
    if os.environ.get("DATABASE_URL") or os.environ.get("DB_HOST"):
        return resolve_database_url().render_as_string(hide_password=False)
    return require_database_url(config.get_main_option("sqlalchemy.url"))


def run_migrations_offline() -> None:
    """Run migrations using a URL without creating an Engine."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations using an Engine and live database connection."""
    section = config.get_section(config.config_ini_section) or {}
    section["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
