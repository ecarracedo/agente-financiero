"""Shared pytest fixtures for isolated portfolio tests."""

import pytest
from peewee import SqliteDatabase

from src.models.database import (
    BibliographyItem,
    PortfolioItem,
    Transaction,
    WishlistItem,
)

MODELS = [PortfolioItem, WishlistItem, Transaction, BibliographyItem]


@pytest.fixture
def isolated_database():
    """Provide a fresh in-memory SQLite database for one test."""
    test_database = SqliteDatabase(":memory:")

    with test_database.bind_ctx(MODELS):
        test_database.connect()
        test_database.create_tables(MODELS)
        try:
            yield test_database
        finally:
            test_database.drop_tables(MODELS)
            test_database.close()
