"""Shared fixtures for backend persistence tests."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.adapters.persistence.models import Base


@pytest.fixture
def session():
    """Provide an isolated in-memory database session per test."""
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as database_session:
        yield database_session
    engine.dispose()
