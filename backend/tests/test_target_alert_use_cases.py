"""Tests for persistent, configurable portfolio target alerts."""

from decimal import Decimal

import pytest
from sqlalchemy import select, update
from sqlalchemy.orm import sessionmaker

from backend.app.adapters.persistence.models import PortfolioPositionRecord, WishlistRecord
from backend.app.adapters.persistence.unit_of_work import SqlAlchemyPortfolioUnitOfWork
from backend.app.application.alerts import TargetAlertUseCases
from backend.app.domain.analysis import QuoteSnapshot
from backend.app.application.resources import ResourceUseCases
from backend.app.domain.alerts import AlertIntent, AlertScope
from backend.app.domain.portfolio import PortfolioPosition


def alert_use_cases(session):
    """Create target-alert use cases backed by the isolated test database."""
    session_factory = sessionmaker(bind=session.get_bind())
    return TargetAlertUseCases(
        lambda: SqlAlchemyPortfolioUnitOfWork(session_factory)
    )


def resource_use_cases(session):
    """Create resource use cases backed by the isolated test database."""
    session_factory = sessionmaker(bind=session.get_bind())
    return ResourceUseCases(lambda: SqlAlchemyPortfolioUnitOfWork(session_factory))


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


def test_wishlist_alert_adds_a_ticker_absent_from_the_wishlist(session):
    """An alert on an unknown ticker adds it to the wishlist and stores the alert."""
    session_factory = sessionmaker(bind=session.get_bind())
    use_cases = alert_use_cases(session)

    use_cases.configure_wishlist_alert("NVDA", Decimal("500"), AlertIntent.BUY)

    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        tickers = [record.ticker for record in unit_of_work.resources.list_wishlist()]
        settings = unit_of_work.resources.get_wishlist_alert("NVDA")

    assert tickers == ["NVDA"]
    assert settings is not None
    assert settings.target_price == Decimal("500")
    assert settings.intent is AlertIntent.BUY


def test_wishlist_alert_updates_an_existing_entry_without_duplicating_it(session):
    """An alert on an existing wishlist entry updates it in place."""
    session_factory = sessionmaker(bind=session.get_bind())
    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        unit_of_work.resources.add_wishlist_item("AAPL")
        unit_of_work.commit()

    use_cases = alert_use_cases(session)
    use_cases.configure_wishlist_alert("AAPL", Decimal("10"), AlertIntent.SELL)

    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        tickers = [record.ticker for record in unit_of_work.resources.list_wishlist()]
        settings = unit_of_work.resources.get_wishlist_alert("AAPL")

    assert tickers == ["AAPL"]
    assert settings is not None
    assert settings.target_price == Decimal("10")
    assert settings.intent is AlertIntent.SELL


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


def test_list_alerts_returns_only_configured_alerts_in_scope_then_ticker_order(session):
    """Listing returns configured alerts, portfolio first, ticker A to Z within a scope."""
    session_factory = sessionmaker(bind=session.get_bind())
    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        for ticker in ("MSFT", "AAPL", "GOOG"):
            unit_of_work.portfolio.save_position(
                PortfolioPosition(
                    ticker=ticker,
                    broker="Broker A",
                    category="Acciones",
                    quantity=Decimal("1"),
                    average_price=Decimal("100"),
                    currency="USD",
                )
            )
        unit_of_work.resources.add_wishlist_item("NVDA")
        unit_of_work.resources.add_wishlist_item("AMD")
        unit_of_work.commit()

    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "MSFT", "Broker A", "Acciones", Decimal("300"), AlertIntent.SELL
    )
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("150"), AlertIntent.BUY
    )
    use_cases.configure_wishlist_alert("NVDA", Decimal("500"), AlertIntent.BUY)

    alerts = use_cases.list_alerts()

    assert [(alert.scope, alert.ticker) for alert in alerts] == [
        ("portfolio", "AAPL"),
        ("portfolio", "MSFT"),
        ("wishlist", "NVDA"),
    ]
    apple, microsoft, nvidia = alerts
    assert apple.target_price == Decimal("150")
    assert apple.intent is AlertIntent.BUY
    assert apple.broker == "Broker A"
    assert apple.category == "Acciones"
    assert apple.currency == "USD"
    assert apple.last_observed_price is None
    assert microsoft.intent is AlertIntent.SELL
    assert nvidia.broker is None
    assert nvidia.category is None
    assert nvidia.currency is None
    assert nvidia.target_price == Decimal("500")


def test_list_alerts_skips_rows_whose_stored_intent_no_longer_exists(session):
    """A row saved with a removed intent stays inactive and is not listed."""
    seed_position(session)
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )
    session.execute(
        update(PortfolioPositionRecord).values(alert_intent="STOP_LOSS")
    )
    session.commit()

    assert use_cases.list_alerts() == ()


def test_delete_portfolio_alert_clears_the_alert_and_keeps_the_position(session):
    """Deleting a portfolio alert leaves the holding in place and unmonitored."""
    seed_position(session)
    use_cases = alert_use_cases(session)
    use_cases.configure_portfolio_alert(
        "AAPL", "Broker A", "Acciones", Decimal("10"), AlertIntent.BUY
    )

    assert use_cases.delete_portfolio_alert("AAPL", "Broker A", "Acciones") is True

    assert use_cases.list_alerts() == ()
    with SqlAlchemyPortfolioUnitOfWork(sessionmaker(bind=session.get_bind())) as unit_of_work:
        assert unit_of_work.portfolio.get_position("AAPL", "Broker A", "Acciones") is not None
        assert unit_of_work.portfolio.get_position_alert("AAPL", "Broker A", "Acciones") is None


def test_delete_unconfigured_portfolio_alert_reports_nothing_deleted(session):
    """Deleting an alert that was never configured reports no deletion."""
    seed_position(session)

    assert (
        alert_use_cases(session).delete_portfolio_alert("AAPL", "Broker A", "Acciones")
        is False
    )


def test_delete_wishlist_alert_clears_the_alert_and_keeps_the_entry(session):
    """Deleting a wishlist alert keeps the wishlist entry and stops monitoring it."""
    session_factory = sessionmaker(bind=session.get_bind())
    use_cases = alert_use_cases(session)
    use_cases.configure_wishlist_alert("NVDA", Decimal("500"), AlertIntent.BUY)

    assert use_cases.delete_wishlist_alert("NVDA") is True

    assert use_cases.list_alerts() == ()
    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        assert [record.ticker for record in unit_of_work.resources.list_wishlist()] == ["NVDA"]
        assert unit_of_work.resources.get_wishlist_alert("NVDA") is None


def test_delete_unconfigured_wishlist_alert_reports_nothing_deleted(session):
    """Deleting a wishlist alert that was never configured reports no deletion."""
    assert alert_use_cases(session).delete_wishlist_alert("NVDA") is False


@pytest.mark.parametrize(
    ("ticker", "message"),
    [
        ("   ", "ticker is required"),
        ("A" * 33, "ticker must be at most 32 characters"),
    ],
)
def test_wishlist_alert_rejects_an_invalid_ticker_without_persisting(
    session, ticker, message
):
    """An invalid ticker is refused instead of creating an unusable wishlist row."""
    session_factory = sessionmaker(bind=session.get_bind())
    use_cases = alert_use_cases(session)

    with pytest.raises(ValueError, match=message):
        use_cases.configure_wishlist_alert(ticker, Decimal("500"), AlertIntent.BUY)

    with SqlAlchemyPortfolioUnitOfWork(session_factory) as unit_of_work:
        assert unit_of_work.resources.list_wishlist() == []


def test_wishlist_target_configures_a_default_buy_alert(session):
    """Saving a wishlist target registers it as a monitored buy alert."""
    resources = resource_use_cases(session)
    resources.add_wishlist_item("AAPL")

    assert resources.update_wishlist_target("AAPL", Decimal("150")) is True

    alerts = alert_use_cases(session).list_alerts()
    assert [
        (alert.scope, alert.ticker, alert.target_price, alert.intent) for alert in alerts
    ] == [(AlertScope.WISHLIST, "AAPL", Decimal("150"), AlertIntent.BUY)]


def test_wishlist_target_update_preserves_the_existing_intent(session):
    """Changing a target keeps the direction configured on that wishlist alert."""
    alerts = alert_use_cases(session)
    alerts.configure_wishlist_alert("AAPL", Decimal("100"), AlertIntent.SELL)

    assert resource_use_cases(session).update_wishlist_target("AAPL", Decimal("200")) is True

    configured = alerts.list_alerts()
    assert len(configured) == 1
    assert configured[0].target_price == Decimal("200")
    assert configured[0].intent == AlertIntent.SELL


def test_clearing_a_wishlist_target_removes_its_alert(session):
    """Clearing a target unregisters the alert while keeping the wishlist entry."""
    resources = resource_use_cases(session)
    resources.add_wishlist_item("AAPL")
    resources.update_wishlist_target("AAPL", Decimal("150"))

    assert resources.update_wishlist_target("AAPL", None) is True

    assert alert_use_cases(session).list_alerts() == ()
    assert [item.ticker for item in resources.list_wishlist()] == ["AAPL"]
    assert session.scalar(
        select(WishlistRecord).where(WishlistRecord.ticker == "AAPL")
    ).alert_intent is None


def test_legacy_wishlist_target_is_listed_as_a_buy_alert(session):
    """A target saved before intents existed is shown as a buy alert."""
    resources = resource_use_cases(session)
    resources.add_wishlist_item("AAPL")
    session.execute(
        update(WishlistRecord)
        .where(WishlistRecord.ticker == "AAPL")
        .values(target_price=Decimal("150"), alert_intent=None)
    )
    session.commit()

    alerts = alert_use_cases(session)
    configured = alerts.list_alerts()
    assert [
        (alert.scope, alert.ticker, alert.target_price, alert.intent)
        for alert in configured
    ] == [(AlertScope.WISHLIST, "AAPL", Decimal("150"), AlertIntent.BUY)]

    assert alerts.evaluate_wishlist_alert("AAPL", Decimal("160")) is None
    crossing = alerts.evaluate_wishlist_alert("AAPL", Decimal("140"))
    assert crossing is not None
    assert crossing.intent is AlertIntent.BUY


class StubCurrencyProvider:
    """Return a fixed quote currency for every ticker lookup."""

    def __init__(self, currency):
        self.currency = currency
        self.requested = []

    def get_quote(self, ticker):
        """Record the lookup and return a deterministic quote snapshot."""
        self.requested.append(ticker)
        return QuoteSnapshot(Decimal("10"), self.currency)


def test_wishlist_alert_carries_the_quote_currency(session):
    """A configured wishlist target reports the provider's currency."""
    resources = resource_use_cases(session)
    resources.add_wishlist_item("MSFT.BA")
    resources.update_wishlist_target("MSFT.BA", Decimal("30900"))
    provider = StubCurrencyProvider("ARS")
    session_factory = sessionmaker(bind=session.get_bind())
    alerts = TargetAlertUseCases(
        lambda: SqlAlchemyPortfolioUnitOfWork(session_factory),
        market_data_provider=provider,
    )

    configured = alerts.list_alerts()
    assert len(configured) == 1
    assert configured[0].currency == "ARS"
    assert provider.requested == ["MSFT.BA"]


def test_list_wishlist_exposes_the_quote_currency(session):
    """Every wishlist entry reports its currency for the canonical money format."""
    resources = resource_use_cases(session)
    resources.add_wishlist_item("AAPL")
    provider = StubCurrencyProvider("USD")
    session_factory = sessionmaker(bind=session.get_bind())
    with_currency = ResourceUseCases(
        lambda: SqlAlchemyPortfolioUnitOfWork(session_factory),
        market_data_provider=provider,
    )

    assert [(item.ticker, item.currency) for item in with_currency.list_wishlist()] == [
        ("AAPL", "USD")
    ]
