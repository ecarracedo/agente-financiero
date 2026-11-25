"""Application use cases for wishlist, bibliography, and split projections."""

from dataclasses import dataclass
from decimal import Decimal

from backend.app.application.currency import resolve_currency
from backend.app.application.ports import (
    MarketDataProviderPort,
    PortfolioUnitOfWorkFactory,
)
from backend.app.domain.alerts import AlertIntent, TargetAlertSettings
from backend.app.domain.calculations import calculate_split_projection


@dataclass(frozen=True)
class WishlistItemSummary:
    """Expose a wishlist entry without leaking its ORM record."""

    ticker: str
    target_price: Decimal | None
    alert_intent: str | None = None
    currency: str | None = None


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

    def __init__(
        self,
        unit_of_work_factory: PortfolioUnitOfWorkFactory,
        *,
        market_data_provider: MarketDataProviderPort | None = None,
    ) -> None:
        """Initialize resource use cases with a caller-supplied unit of work.

        The optional market data provider resolves each entry's quote currency
        for the canonical money format; an unknown currency stays unset.
        """
        self._unit_of_work_factory = unit_of_work_factory
        self._market_data_provider = market_data_provider

    def add_wishlist_item(self, ticker: str) -> WishlistItemSummary:
        """Add a normalized ticker to the persisted wishlist."""
        with self._unit_of_work_factory() as unit_of_work:
            record = unit_of_work.resources.add_wishlist_item(ticker)
            unit_of_work.commit()
            return WishlistItemSummary(
                record.ticker,
                record.target_price,
                record.alert_intent,
                resolve_currency(self._market_data_provider, record.ticker),
            )

    def update_wishlist_target(
        self, ticker: str, target_price: Decimal | None
    ) -> bool:
        """Set or clear a wishlist target and keep its configured alert in sync.

        A saved target is monitored immediately: a new one gets a buy intent,
        while an existing alert keeps its direction and only changes price.
        Clearing the target also unregisters the alert, leaving the entry itself.
        """
        with self._unit_of_work_factory() as unit_of_work:
            if target_price is None:
                updated = unit_of_work.resources.update_wishlist_target(ticker, None)
                if updated:
                    unit_of_work.resources.clear_wishlist_alert(ticker)
            else:
                existing = unit_of_work.resources.get_wishlist_alert(ticker)
                intent = existing.intent if existing is not None else AlertIntent.BUY
                updated = unit_of_work.resources.set_wishlist_alert(
                    ticker, TargetAlertSettings(target_price, intent)
                )
            if updated:
                unit_of_work.commit()
            return updated

    def list_wishlist(self) -> list[WishlistItemSummary]:
        """List persisted wishlist entries in repository order."""
        with self._unit_of_work_factory() as unit_of_work:
            records = unit_of_work.resources.list_wishlist()
            return [
                WishlistItemSummary(
                    record.ticker,
                    record.target_price,
                    record.alert_intent,
                    resolve_currency(self._market_data_provider, record.ticker),
                )
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

    def list_ticker_aliases(self) -> list[dict]:
        """List persisted ticker aliases."""
        with self._unit_of_work_factory() as unit_of_work:
            records = unit_of_work.resources.list_ticker_aliases()
            return [
                {
                    "id": record.id,
                    "broker_ticker": record.broker_ticker,
                    "official_name": record.official_name,
                    "provider": record.provider,
                }
                for record in records
            ]

    def add_ticker_alias(
        self, broker_ticker: str, official_name: str, provider: str = "ppi"
    ) -> dict:
        """Persist a ticker alias and return its data."""
        with self._unit_of_work_factory() as unit_of_work:
            record = unit_of_work.resources.add_ticker_alias(
                broker_ticker, official_name, provider
            )
            unit_of_work.commit()
            return {
                "id": record.id,
                "broker_ticker": record.broker_ticker,
                "official_name": record.official_name,
                "provider": record.provider,
            }

    def remove_ticker_alias(self, alias_id: int) -> bool:
        """Delete a ticker alias and commit when it existed."""
        with self._unit_of_work_factory() as unit_of_work:
            removed = unit_of_work.resources.remove_ticker_alias(alias_id)
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
