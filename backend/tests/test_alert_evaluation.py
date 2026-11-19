"""Tests for the crossings the alert use cases persist while evaluating."""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import sessionmaker

from backend.app.adapters.persistence.unit_of_work import (
    SqlAlchemyPortfolioUnitOfWork,
)
from backend.app.application.alerts import TargetAlertUseCases
from backend.app.domain.alerts import AlertIntent, AlertScope
from backend.app.domain.portfolio import PortfolioPosition

NOW = datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)


def alert_use_cases(session, now=NOW):
    """Create alert use cases backed by the isolated test database."""
    session_factory = sessionmaker(bind=session.get_bind())
    return TargetAlertUseCases(
        lambda: SqlAlchemyPortfolioUnitOfWork(session_factory),
        now=lambda: now,
    )


def seed_position(session, ticker="AAPL", currency="USD"):
    """Persist one portfolio position for the alert use cases."""
    session_factory = sessionmaker(bind=session.get_bind())
    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        unit_of_work.portfolio.save_position(
            PortfolioPosition(
                ticker=ticker,
                broker="Broker A",
                category="Acciones",
                quantity=Decimal("2"),
                average_price=Decimal("10"),
                currency=currency,
            )
        )
        unit_of_work.commit()


def test_portfolio_crossing_is_persisted_with_its_asset_identity(session):
    """One crossing is stored once, with broker, category and currency."""
    seed_position(session)
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )

    use_cases.evaluate_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("11")
    )
    event = use_cases.evaluate_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10")
    )
    repeated = use_cases.evaluate_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("9")
    )
    stored = use_cases.list_events()

    assert event is not None
    assert repeated is None
    assert len(stored) == 1
    assert stored[0].scope is AlertScope.PORTFOLIO
    assert stored[0].ticker == "AAPL"
    assert stored[0].broker == "Broker A"
    assert stored[0].category == "Acciones"
    assert stored[0].currency == "USD"
    assert stored[0].target_price == Decimal("10")
    assert stored[0].observed_price == Decimal("10")
    assert stored[0].triggered_at.replace(tzinfo=timezone.utc) == NOW


def test_wishlist_crossing_is_persisted_without_portfolio_attributes(session):
    """A wishlist crossing is stored with no broker, category or currency."""
    use_cases = alert_use_cases(session)
    use_cases.configure_wishlist_alert("NVDA", Decimal("500"), AlertIntent.SELL)
    use_cases.evaluate_wishlist_alert("NVDA", Decimal("400"))
    use_cases.evaluate_wishlist_alert("NVDA", Decimal("600"))

    stored = use_cases.list_events()

    assert len(stored) == 1
    assert stored[0].scope is AlertScope.WISHLIST
    assert stored[0].broker is None
    assert stored[0].category is None
    assert stored[0].currency is None


def test_ticker_evaluation_records_every_alert_of_that_ticker(session):
    """One ticker pass persists portfolio and wishlist crossings together."""
    seed_position(session)
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )
    use_cases.configure_wishlist_alert("AAPL", Decimal("20"), AlertIntent.SELL)
    use_cases.evaluate_alert("AAPL", Decimal("11"))
    portfolio_crossing = use_cases.evaluate_alert("AAPL", Decimal("10"))
    wishlist_crossing = use_cases.evaluate_alert("AAPL", Decimal("21"))
    stored = use_cases.list_events()

    assert len(portfolio_crossing) == 1
    assert len(wishlist_crossing) == 1
    assert all(event.id > 0 for event in (*portfolio_crossing, *wishlist_crossing))
    assert {event.scope for event in stored} == {
        AlertScope.PORTFOLIO,
        AlertScope.WISHLIST,
    }
    assert len(stored) == 2


def test_acknowledged_events_are_hidden_until_requested(session):
    """Acknowledging hides an event from the default listing only."""
    seed_position(session)
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )
    use_cases.evaluate_alert("AAPL", Decimal("11"))
    use_cases.evaluate_alert("AAPL", Decimal("10"))
    stored = use_cases.list_events()[0]

    acknowledged = use_cases.acknowledge_event(stored.id, NOW)

    assert acknowledged is True
    assert use_cases.list_events() == ()
    including = use_cases.list_events(include_acknowledged=True)
    assert len(including) == 1
    assert including[0].acknowledged_at is not None
