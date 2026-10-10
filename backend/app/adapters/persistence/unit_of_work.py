"""SQLAlchemy unit of work for atomic application operations."""

from collections.abc import Callable
from types import TracebackType
from typing import Literal

from sqlalchemy.orm import Session

from backend.app.adapters.persistence.repositories import (
    SqlAlchemyPortfolioRepository,
    SqlAlchemyResourceRepository,
)
from backend.app.application.ports import (
    PortfolioRepositoryPort,
    ResourceRepositoryPort,
)


class SqlAlchemyPortfolioUnitOfWork:
    """Manage one SQLAlchemy session and its commit/rollback boundary."""

    portfolio: PortfolioRepositoryPort
    resources: ResourceRepositoryPort

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        """Initialize with a factory that creates an isolated session."""
        self._session_factory = session_factory
        self._session: Session | None = None
        self._committed = False

    def __enter__(self) -> "SqlAlchemyPortfolioUnitOfWork":
        """Open a session and expose its portfolio repository."""
        self._session = self._session_factory()
        self.portfolio = SqlAlchemyPortfolioRepository(self._session)
        self.resources = SqlAlchemyResourceRepository(self._session)
        return self

    def commit(self) -> None:
        """Commit all repository changes in this unit of work."""
        if self._session is None:
            raise RuntimeError("unit of work is not active")
        self._session.commit()
        self._committed = True

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> Literal[False]:
        """Rollback uncommitted work and close the owned session."""
        if self._session is not None:
            if exc_type is not None or not self._committed:
                self._session.rollback()
            self._session.close()
            self._session = None
        return False
