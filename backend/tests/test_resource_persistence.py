"""Tests for wishlist and bibliography persistence adapters."""

from decimal import Decimal

from backend.app.adapters.persistence.repositories import SqlAlchemyResourceRepository


def test_wishlist_crud_persists_normalized_ticker(session):
    """Wishlist create, target update, and delete persist through a repository."""
    repository = SqlAlchemyResourceRepository(session)

    with session.begin():
        created = repository.add_wishlist_item(" aapl ")
        updated = repository.update_wishlist_target("AAPL", 150.25)
        items = repository.list_wishlist()
        assert created.ticker == "AAPL"
        assert updated is True
        assert len(items) == 1
        assert items[0].target_price == Decimal("150.25")

        removed = repository.remove_wishlist_item("AAPL")
        assert removed is True
        assert repository.list_wishlist() == []


def test_bibliography_crud_preserves_optional_metadata(session):
    """Bibliography create, list, and delete preserve resource metadata."""
    repository = SqlAlchemyResourceRepository(session)

    with session.begin():
        created = repository.add_bibliography_item(
            title="Market Structure",
            author="A. Author",
            year=2024,
            category="Books",
            link="https://example.test/book",
            description="Reference material",
        )

        items = repository.list_bibliography()
        assert len(items) == 1
        assert items[0].id == created.id
        assert items[0].title == "Market Structure"
        assert items[0].year == 2024
        assert items[0].link == "https://example.test/book"

        removed = repository.remove_bibliography_item(created.id)
        assert removed is True
        assert repository.list_bibliography() == []
