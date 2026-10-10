"""Application use cases for wishlist, bibliography, and split projections."""

from dataclasses import dataclass
from decimal import Decimal

from backend.app.application.ports import PortfolioUnitOfWorkFactory
from backend.app.domain.calculations import calculate_split_projection


@dataclass(frozen=True)
class WishlistItemSummary:
    """Expose a wishlist entry without leaking its ORM record."""

    ticker: str
    target_price: Decimal | None


@dataclass(frozen=True)
class BibliographyItemSummary:
    """Expose a bibliography resource without leaking its ORM record."""

    id: int
    title: str
    author: str
    year: int | None
    category: str
    link: str | None
    description: str | None


class ResourceUseCases:
    """Coordinate resource CRUD and pure split calculations."""

    def __init__(self, unit_of_work_factory: PortfolioUnitOfWorkFactory) -> None:
        """Initialize resource use cases with a caller-supplied unit of work."""
        self._unit_of_work_factory = unit_of_work_factory

    def add_wishlist_item(self, ticker: str) -> WishlistItemSummary:
        """Add a normalized ticker to the persisted wishlist."""
        with self._unit_of_work_factory() as unit_of_work:
            record = unit_of_work.resources.add_wishlist_item(ticker)
            unit_of_work.commit()
            return WishlistItemSummary(record.ticker, record.target_price)

    def update_wishlist_target(
        self, ticker: str, target_price: Decimal | None
    ) -> bool:
        """Set or clear a wishlist target price."""
        with self._unit_of_work_factory() as unit_of_work:
            updated = unit_of_work.resources.update_wishlist_target(
                ticker, target_price
            )
            if updated:
                unit_of_work.commit()
            return updated

    def list_wishlist(self) -> list[WishlistItemSummary]:
        """List persisted wishlist entries in repository order."""
        with self._unit_of_work_factory() as unit_of_work:
            records = unit_of_work.resources.list_wishlist()
            return [
                WishlistItemSummary(record.ticker, record.target_price)
                for record in records
            ]

    def remove_wishlist_item(self, ticker: str) -> bool:
        """Remove a wishlist entry and commit only when one existed."""
        with self._unit_of_work_factory() as unit_of_work:
            removed = unit_of_work.resources.remove_wishlist_item(ticker)
            if removed:
                unit_of_work.commit()
            return removed

    def add_bibliography_item(
        self,
        *,
        title: str,
        author: str,
        year: int | None = None,
        category: str = "General",
        link: str | None = None,
        description: str | None = None,
    ) -> BibliographyItemSummary:
        """Persist a bibliography resource with optional descriptive metadata."""
        with self._unit_of_work_factory() as unit_of_work:
            record = unit_of_work.resources.add_bibliography_item(
                title=title,
                author=author,
                year=year,
                category=category,
                link=link,
                description=description,
            )
            unit_of_work.commit()
            return BibliographyItemSummary(
                record.id,
                record.title,
                record.author,
                record.year,
                record.category,
                record.link,
                record.description,
            )

    def list_bibliography(self) -> list[BibliographyItemSummary]:
        """List persisted bibliography resources in repository order."""
        with self._unit_of_work_factory() as unit_of_work:
            records = unit_of_work.resources.list_bibliography()
            return [
                BibliographyItemSummary(
                    record.id,
                    record.title,
                    record.author,
                    record.year,
                    record.category,
                    record.link,
                    record.description,
                )
                for record in records
            ]

    def delete_bibliography_item(self, item_id: int) -> bool:
        """Delete a bibliography resource and commit when it existed."""
        with self._unit_of_work_factory() as unit_of_work:
            removed = unit_of_work.resources.remove_bibliography_item(item_id)
            if removed:
                unit_of_work.commit()
            return removed

    def calculate_split(
        self,
        quantity: Decimal,
        average_price: Decimal,
        *,
        new_shares: int,
        old_shares: int,
    ) -> tuple[Decimal, Decimal, Decimal]:
        """Project a forward or reverse split without persistence side effects."""
        return calculate_split_projection(
            quantity, average_price, new_shares, old_shares
        )
