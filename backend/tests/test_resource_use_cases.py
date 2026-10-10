"""Tests for wishlist, bibliography, and split application use cases."""

from decimal import Decimal
from sqlalchemy.orm import sessionmaker

from backend.app.adapters.persistence.unit_of_work import SqlAlchemyPortfolioUnitOfWork
from backend.app.application.resources import ResourceUseCases


def resource_use_cases(session):
    """Build resource use cases backed by the isolated test database."""
    session_factory = sessionmaker(bind=session.get_bind())
    return ResourceUseCases(
        lambda: SqlAlchemyPortfolioUnitOfWork(session_factory)
    )


def test_wishlist_lifecycle_normalizes_ticker_and_target(session):
    """Wishlist use cases create, update, list, and remove an item."""
    use_cases = resource_use_cases(session)

    created = use_cases.add_wishlist_item(" aapl ")
    assert created.ticker == "AAPL"
    assert created.target_price is None

    assert use_cases.update_wishlist_target("AAPL", Decimal("150.25")) is True
    items = use_cases.list_wishlist()
    assert len(items) == 1
    assert items[0].target_price == Decimal("150.25")

    assert use_cases.remove_wishlist_item("AAPL") is True
    assert use_cases.list_wishlist() == []


def test_bibliography_lifecycle_preserves_optional_metadata(session):
    """Bibliography use cases preserve metadata through create/list/delete."""
    use_cases = resource_use_cases(session)

    created = use_cases.add_bibliography_item(
        title="Market Structure",
        author="A. Author",
        year=2024,
        category="Books",
        link="https://example.test/book",
        description="Reference material",
    )
    items = use_cases.list_bibliography()

    assert len(items) == 1
    assert items[0].id == created.id
    assert items[0].title == "Market Structure"
    assert items[0].year == 2024
    assert items[0].link == "https://example.test/book"
    assert use_cases.delete_bibliography_item(created.id) is True
    assert use_cases.list_bibliography() == []


def test_split_use_case_projects_forward_and_reverse_ratios():
    """Split use cases return exact Decimal projections for either direction."""
    use_cases = ResourceUseCases(unit_of_work_factory=lambda: None)

    forward = use_cases.calculate_split(
        Decimal("100"), Decimal("10"), new_shares=2, old_shares=1
    )
    reverse = use_cases.calculate_split(
        Decimal("100"), Decimal("10"), new_shares=1, old_shares=4
    )

    assert forward == (Decimal("200"), Decimal("5"), Decimal("2"))
    assert reverse == (Decimal("25"), Decimal("40"), Decimal("0.25"))
