"""Tests for mandatory Alembic database configuration."""

import pytest

from backend.app.adapters.persistence.database import require_database_url


def test_alembic_uses_configured_database_url():
    """A configured migration URL is returned unchanged."""
    configured_url = "postgresql+psycopg://user:secret@db:5432/financial_agent"

    assert require_database_url(configured_url) == configured_url


def test_alembic_rejects_missing_database_url():
    """Missing migration configuration fails explicitly instead of being nullable."""
    with pytest.raises(RuntimeError, match="database URL is required"):
        require_database_url(None)
