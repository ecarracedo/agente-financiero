"""SQLAlchemy engine creation and database connectivity checks."""

import os

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import URL, make_url


def require_database_url(database_url: str | None) -> str:
    """Return a configured database URL or fail with a clear configuration error."""
    if not database_url:
        raise RuntimeError("database URL is required")
    return database_url


def resolve_database_url(database_url: str | None = None) -> URL:
    """Resolve a SQLAlchemy URL from explicit or environment configuration.

    Args:
        database_url: Optional SQLAlchemy URL. If omitted, ``DATABASE_URL`` is
            preferred, then separate ``DB_HOST``, ``DB_NAME``, ``DB_USER``,
            ``DB_PASSWORD``, and optional ``DB_PORT`` values are used.

    Returns:
        A parsed SQLAlchemy URL. Password characters are preserved safely.

    Raises:
        RuntimeError: If no complete database configuration is provided.
    """
    resolved_url = database_url or os.environ.get("DATABASE_URL")
    if resolved_url:
        return make_url(resolved_url)

    required = ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing database configuration: {', '.join(missing)}")

    return URL.create(
        drivername="postgresql+psycopg",
        username=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "5432")),
        database=os.environ["DB_NAME"],
    )


def create_database_engine(database_url: str | None = None) -> Engine:
    """Create a pooled SQLAlchemy engine with connection health checks."""
    return create_engine(resolve_database_url(database_url), pool_pre_ping=True)


def check_database_connection(engine: Engine) -> None:
    """Execute a lightweight query to verify database readiness."""
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
