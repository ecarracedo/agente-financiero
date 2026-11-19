"""Tests for the alert monitor: one quote per ticker, isolated failures."""

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy.orm import sessionmaker

from backend.app.adapters.persistence.unit_of_work import (
    SqlAlchemyPortfolioUnitOfWork,
)
from backend.app.application.alerts import TargetAlertUseCases
from backend.app.application.alert_monitor import AlertMonitorUseCases
from backend.app.domain.alerts import AlertIntent, AlertScope
from backend.app.domain.portfolio import PortfolioPosition

NOW = datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)


class StubMarketData:
    """Return configured quotes and remember how often each ticker was quoted."""

    def __init__(self, prices=None, failing=()):
        """Store the quotes to serve and the tickers that must raise."""
        self.prices = prices or {}
        self.failing = set(failing)
        self.requested = []

    def get_quote(self, ticker):
        """Return the configured quote, raise when failing, or return None."""
        self.requested.append(ticker)
        if ticker in self.failing:
            raise RuntimeError("provider unavailable")
        price = self.prices.get(ticker)
        return None if price is None else SimpleNamespace(price=price, currency="USD")

    def get_historical_series(self, ticker, period):
        """Return no history; alerts only need the current quote."""
        return ()

    def search_symbols(self, query, limit=10):
        """Return no matches; alerts never search."""
        return ()


def alert_use_cases(session):
    """Create alert use cases backed by the isolated test database."""
    session_factory = sessionmaker(bind=session.get_bind())
    return TargetAlertUseCases(
        lambda: SqlAlchemyPortfolioUnitOfWork(session_factory),
        now=lambda: NOW,
    )


def seed_position(session, ticker="AAPL"):
    """Persist one portfolio position that can carry a target alert."""
    session_factory = sessionmaker(bind=session.get_bind())
    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        unit_of_work.portfolio.save_position(
            PortfolioPosition(
                ticker=ticker,
                broker="Broker A",
                category="Acciones",
                quantity=Decimal("2"),
                average_price=Decimal("10"),
                currency="USD",
            )
        )
        unit_of_work.commit()


def test_a_ticker_monitored_twice_costs_one_quote(session):
    """Portfolio and wishlist alerts on one ticker share a single quote."""
    seed_position(session)
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )
    use_cases.configure_wishlist_alert("AAPL", Decimal("20"), AlertIntent.SELL)
    market_data = StubMarketData({"AAPL": Decimal("11")})
    monitor = AlertMonitorUseCases(use_cases, market_data)

    monitor.evaluate_all()
    market_data.prices["AAPL"] = Decimal("10")
    market_data.requested.clear()
    events = monitor.evaluate_all()

    assert market_data.requested == ["AAPL"]
    assert len(events) == 1


def test_a_missing_quote_skips_only_that_ticker(session):
    """A ticker without a quote does not stop the other tickers."""
    seed_position(session, "AAPL")
    seed_position(session, "MSFT")
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )
    use_cases.configure_portfolio_alert(
        "MSFT", "Broker A", "Acciones", Decimal("50"), AlertIntent.BUY
    )
    market_data = StubMarketData({"AAPL": Decimal("11")})
    monitor = AlertMonitorUseCases(use_cases, market_data)

    monitor.evaluate_all()
    market_data.prices["AAPL"] = Decimal("10")
    monitor.evaluate_all()

    stored = use_cases.list_events()
    assert [event.ticker for event in stored] == ["AAPL"]


def test_a_provider_failure_skips_only_that_ticker(session):
    """A raising provider call is isolated to its own ticker."""
    seed_position(session, "AAPL")
    seed_position(session, "MSFT")
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )
    use_cases.configure_portfolio_alert(
        "MSFT", "Broker A", "Acciones", Decimal("50"), AlertIntent.BUY
    )
    market_data = StubMarketData({"AAPL": Decimal("11")}, failing={"MSFT"})
    monitor = AlertMonitorUseCases(use_cases, market_data)

    monitor.evaluate_all()
    market_data.prices["AAPL"] = Decimal("10")
    monitor.evaluate_all()

    stored = use_cases.list_events()
    assert [event.ticker for event in stored] == ["AAPL"]
    assert stored[0].scope is AlertScope.PORTFOLIO


def test_a_pass_returns_the_events_it_recorded(session):
    """The pass reports the persisted projections, with their event ids."""
    seed_position(session)
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )
    market_data = StubMarketData({"AAPL": Decimal("11")})
    monitor = AlertMonitorUseCases(use_cases, market_data)
    monitor.evaluate_all()

    market_data.prices["AAPL"] = Decimal("10")
    events = monitor.evaluate_all()

    assert len(events) == 1
    assert events[0].id > 0
    assert events[0].ticker == "AAPL"
