"""Tests for environment-based database engine configuration."""

from backend.app.adapters.persistence.database import resolve_database_url


def test_engine_builds_postgres_url_from_separate_environment_values(monkeypatch):
    """A reserved password character remains a password, not URL syntax."""
    monkeypatch.setenv("DB_HOST", "postgres")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("DB_NAME", "financial_agent")
    monkeypatch.setenv("DB_USER", "financial_agent")
    monkeypatch.setenv("DB_PASSWORD", "p@ss/word:with#symbols")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    url = resolve_database_url()

    assert url.drivername == "postgresql+psycopg"
    assert url.host == "postgres"
    assert url.port == 5432
    assert url.database == "financial_agent"
    assert url.username == "financial_agent"
    assert url.password == "p@ss/word:with#symbols"
