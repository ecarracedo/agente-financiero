"""Ports required by transactional portfolio use cases."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from types import TracebackType
from typing import Callable, Protocol, Self

from backend.app.domain.alerts import TargetAlertSettings
from backend.app.domain.portfolio import PortfolioPosition


class TransactionRecordPort(Protocol):
    """Read-only transaction fields required for history and replay."""

    id: int
    ticker: str
    broker: str
    category: str
    operation_type: str
    quantity: Decimal
    unit_price: Decimal
    currency: str
    occurred_at: datetime


class PortfolioRepositoryPort(Protocol):
    """Persistence operations required by portfolio use cases."""

    def get_position(
        self, ticker: str, broker: str, category: str
    ) -> PortfolioPosition | None: ...

    def list_positions(self) -> list[PortfolioPosition]: ...

    def save_position(self, position: PortfolioPosition) -> None: ...

    def delete_position(self, ticker: str, broker: str, category: str) -> None: ...

    def set_position_alert(
        self, ticker: str, broker: str, category: str, settings: TargetAlertSettings
    ) -> bool: ...

    def get_position_alert(
        self, ticker: str, broker: str, category: str
    ) -> TargetAlertSettings | None: ...

    def update_position_alert_price(
        self, ticker: str, broker: str, category: str, price: Decimal
    ) -> bool: ...

    def add_transaction(
        self,
        *,
        ticker: str,
        broker: str,
        category: str,
        operation_type: str,
        quantity: Decimal,
        unit_price: Decimal,
        currency: str,
        occurred_at: datetime,
    ) -> TransactionRecordPort: ...

    def get_transaction(self, transaction_id: int) -> TransactionRecordPort | None: ...

    def delete_transaction(self, transaction_id: int) -> bool: ...

    def list_transactions(
        self, ticker: str, broker: str
    ) -> Sequence[TransactionRecordPort]: ...


class PortfolioUnitOfWorkPort(Protocol):
    """Caller-controlled transaction boundary for portfolio persistence."""

    portfolio: PortfolioRepositoryPort
    resources: ResourceRepositoryPort

    def __enter__(self) -> Self: ...

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> bool | None: ...

    def commit(self) -> None: ...


class WishlistRecordPort(Protocol):
    """Read-only wishlist fields exposed to application use cases."""

    ticker: str
    target_price: Decimal | None


class BibliographyRecordPort(Protocol):
    """Read-only bibliography fields exposed to application use cases."""

    id: int
    title: str
    author: str
    year: int | None
    category: str
    link: str | None
    description: str | None


class ResourceRepositoryPort(Protocol):
    """Target-alert operations for wishlist resources."""

    def add_wishlist_item(self, ticker: str) -> WishlistRecordPort: ...

    def update_wishlist_target(
        self, ticker: str, target_price: Decimal | None
    ) -> bool: ...

    def list_wishlist(self) -> Sequence[WishlistRecordPort]: ...

    def remove_wishlist_item(self, ticker: str) -> bool: ...

    def add_bibliography_item(
        self,
        *,
        title: str,
        author: str,
        year: int | None = None,
        category: str = "General",
        link: str | None = None,
        description: str | None = None,
    ) -> BibliographyRecordPort: ...

    def list_bibliography(self) -> Sequence[BibliographyRecordPort]: ...

    def remove_bibliography_item(self, item_id: int) -> bool: ...

    def set_wishlist_alert(
        self, ticker: str, settings: TargetAlertSettings
    ) -> bool: ...

    def get_wishlist_alert(self, ticker: str) -> TargetAlertSettings | None: ...

    def update_wishlist_alert_price(self, ticker: str, price: Decimal) -> bool: ...


class PortfolioReadRepositoryPort(Protocol):
    """Read-only portfolio queries required by analytics use cases."""

    def list_positions(self) -> list[PortfolioPosition]: ...


class MarketDataProviderPort(Protocol):
    """Read-only market data interface used by backend application services."""

    def get_current_price(self, ticker: str) -> Decimal | None: ...

    def get_historical_closes(
        self, ticker: str, period: str
    ) -> list[Decimal]: ...


PortfolioUnitOfWorkFactory = Callable[[], PortfolioUnitOfWorkPort]
