"""Tests for persistent, configurable portfolio target alerts."""

from decimal import Decimal

from sqlalchemy.orm import sessionmaker

from backend.app.adapters.persistence.unit_of_work import SqlAlchemyPortfolioUnitOfWork
from backend.app.application.alerts import TargetAlertUseCases
from backend.app.domain.alerts import AlertIntent
from backend.app.domain.portfolio import PortfolioPosition


def alert_use_cases(session):
    """Create target-alert use cases backed by the isolated test database."""
    session_factory = sessionmaker(bind=session.get_bind())
    return TargetAlertUseCases(
        lambda: SqlAlchemyPortfolioUnitOfWork(session_factory)
    )


def seed_position(session):
    """Persist a portfolio position for target-alert tests."""
    session_factory = sessionmaker(bind=session.get_bind())
    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        unit_of_work.portfolio.save_position(
            PortfolioPosition(
                ticker="AAPL",
                broker="Broker A",
                category="Acciones",
                quantity=Decimal("2"),
                average_price=Decimal("10"),
                currency="USD",
            )
        )
        unit_of_work.commit()


def test_buy_alert_persists_intent_and_does_not_repeat(session):
    """A configured buy alert reports one downward crossing without repeats."""
    seed_position(session)
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )

    assert use_cases.evaluate_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("11")
    ) is None
    event = use_cases.evaluate_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10")
    )
    repeated = use_cases.evaluate_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("9")
    )

    assert event is not None
    assert event.intent is AlertIntent.BUY
    assert event.message == "Precio objetivo de compra alcanzado."
    assert repeated is None


def test_sell_alert_only_triggers_on_upward_crossing(session):
    """A sell target triggers upward but not downward."""
    seed_position(session)
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.SELL
    )

    assert use_cases.evaluate_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("9")
    ) is None
    event = use_cases.evaluate_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10")
    )

    assert event is not None
    assert event.intent is AlertIntent.SELL
    assert event.message == "Precio objetivo de venta alcanzado."


def test_unconfigured_alert_does_not_emit_event(session):
    """A holding without configured alert intent produces no alert."""
    seed_position(session)
    use_cases = alert_use_cases(session)

    assert use_cases.evaluate_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10")
    ) is None


def test_wishlist_buy_alert_persists_crossing_state(session):
    """A wishlist alert stores its intent and suppresses repeated crossings."""
    session_factory = sessionmaker(bind=session.get_bind())
    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        unit_of_work.resources.add_wishlist_item("AAPL")
        unit_of_work.commit()

    use_cases = alert_use_cases(session)
    use_cases.configure_wishlist_alert("AAPL", Decimal("10"), AlertIntent.BUY)

    assert use_cases.evaluate_wishlist_alert("AAPL", Decimal("11")) is None
    event = use_cases.evaluate_wishlist_alert("AAPL", Decimal("10"))
    repeated = use_cases.evaluate_wishlist_alert("AAPL", Decimal("9"))

    assert event is not None
    assert event.intent is AlertIntent.BUY
    assert repeated is None
