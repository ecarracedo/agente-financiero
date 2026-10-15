"""Shared fakes and builders for the agent test modules.

Both the tool-serialization tests and the agent-boundary tests need a real read
use-case stack over an isolated in-memory database, plus a market-data provider
they fully control. One implementation lives here so the two modules cannot
drift apart.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.adapters.persistence.models import Base
from backend.app.adapters.persistence.unit_of_work import SqlAlchemyPortfolioUnitOfWork
from backend.app.application.analytics import PortfolioAnalyticsUseCases
from backend.app.application.portfolio import PortfolioUseCases


class FakeMarketDataProvider:
    """Serve configured quotes and series, recording the periods requested.

    Constructed with no arguments it behaves like a provider with no market
    data at all, which is the boundary the agent must report as uncertain.
    """

    def __init__(self, prices=None, series=None):
        """Store the configured quotes and series keyed by ticker."""
        self._prices = dict(prices or {})
        self._series = dict(series or {})
        self.requested_periods = []

    def get_current_price(self, ticker):
        """Return the configured quote for a ticker, or None when there is none."""
        return self._prices.get(ticker)

    def get_historical_series(self, ticker, period):
        """Return the configured dated series and record the requested period."""
        self.requested_periods.append(period)
        return tuple(self._series.get(ticker, ()))


def build_read_use_cases(provider):
    """Build the read use cases over a fresh isolated in-memory database.

    Args:
        provider: The market-data provider the analytics use cases read from.

    Returns:
        A tuple of the owning engine, the portfolio use cases, and the
        analytics use cases bound to the provider. The caller owns the engine
        and may dispose of it when the test is done.
    """
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    def unit_of_work_factory():
        """Create a unit of work bound to the isolated engine."""
        return SqlAlchemyPortfolioUnitOfWork(sessionmaker(bind=engine))

    portfolio = PortfolioUseCases(unit_of_work_factory)
    return engine, portfolio, PortfolioAnalyticsUseCases(portfolio, provider)
