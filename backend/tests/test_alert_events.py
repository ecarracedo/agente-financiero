"""Tests for persisted alert trigger events."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from backend.app.adapters.persistence.repositories import (
    SqlAlchemyAlertEventRepository,
)
from backend.app.domain.alerts import (
    AlertIntent,
    AlertScope,
    ConfiguredAlert,
    TargetAlertEvent,
)


def portfolio_alert() -> ConfiguredAlert:
    """Build a configured portfolio alert for event-persistence tests."""
    return ConfiguredAlert(
        scope=AlertScope.PORTFOLIO,
        ticker="AAPL",
        target_price=Decimal("150"),
        intent=AlertIntent.BUY,
        broker="Broker A",
        category="Acciones",
        currency="USD",
    )


def wishlist_alert() -> ConfiguredAlert:
    """Build a configured wishlist alert for event-persistence tests."""
    return ConfiguredAlert(
        scope=AlertScope.WISHLIST,
        ticker="NVDA",
        target_price=Decimal("500"),
        intent=AlertIntent.SELL,
    )


def event(intent: AlertIntent, message: str) -> TargetAlertEvent:
    """Build the crossing event a repository stores."""
    return TargetAlertEvent(intent=intent, message=message)


def test_recorded_event_keeps_the_asset_and_the_crossing(session):
    """A stored event reports the asset, the crossing and when it happened."""
    repository = SqlAlchemyAlertEventRepository(session)
    triggered_at = datetime(2026, 11, 11, 15, 30, tzinfo=timezone.utc)

    recorded = repository.record_event(
        portfolio_alert(),
        event(AlertIntent.BUY, "Precio objetivo de compra alcanzado."),
        Decimal("149.50"),
        triggered_at,
    )

    assert recorded.id > 0
    assert recorded.scope is AlertScope.PORTFOLIO
    assert recorded.ticker == "AAPL"
    assert recorded.broker == "Broker A"
    assert recorded.category == "Acciones"
    assert recorded.currency == "USD"
    assert recorded.target_price == Decimal("150")
    assert recorded.intent is AlertIntent.BUY
    assert recorded.observed_price == Decimal("149.50")
    assert recorded.message == "Precio objetivo de compra alcanzado."
    assert recorded.triggered_at == triggered_at
    assert recorded.acknowledged_at is None


def test_wishlist_event_reports_no_broker_category_or_currency(session):
    """A wishlist event carries no position attributes instead of inventing them."""
    repository = SqlAlchemyAlertEventRepository(session)

    recorded = repository.record_event(
        wishlist_alert(),
        event(AlertIntent.SELL, "Precio objetivo de venta alcanzado."),
        Decimal("505"),
        datetime(2026, 11, 11, 16, 0, tzinfo=timezone.utc),
    )

    assert recorded.scope is AlertScope.WISHLIST
    assert recorded.broker is None
    assert recorded.category is None
    assert recorded.currency is None
    assert recorded.intent is AlertIntent.SELL


def test_listing_returns_pending_events_newest_first(session):
    """Pending events come back newest first."""
    repository = SqlAlchemyAlertEventRepository(session)
    start = datetime(2026, 11, 11, 12, 0, tzinfo=timezone.utc)
    repository.record_event(
        portfolio_alert(),
        event(AlertIntent.BUY, "Precio objetivo de compra alcanzado."),
        Decimal("149"),
        start,
    )
    repository.record_event(
        wishlist_alert(),
        event(AlertIntent.SELL, "Precio objetivo de venta alcanzado."),
        Decimal("505"),
        start + timedelta(hours=1),
    )

    listed = repository.list_events()

    assert [item.ticker for item in listed] == ["NVDA", "AAPL"]


def test_acknowledged_events_are_hidden_unless_requested(session):
    """Acknowledging an event hides it from the default listing, never deleting it."""
    repository = SqlAlchemyAlertEventRepository(session)
    recorded = repository.record_event(
        portfolio_alert(),
        event(AlertIntent.BUY, "Precio objetivo de compra alcanzado."),
        Decimal("149"),
        datetime(2026, 11, 11, 12, 0, tzinfo=timezone.utc),
    )

    acknowledged = repository.acknowledge_event(
        recorded.id, datetime(2026, 11, 11, 13, 0, tzinfo=timezone.utc)
    )

    assert acknowledged is True
    assert repository.list_events() == ()
    with_acknowledged = repository.list_events(include_acknowledged=True)
    assert [item.id for item in with_acknowledged] == [recorded.id]
    assert with_acknowledged[0].acknowledged_at is not None


def test_acknowledging_an_unknown_event_reports_nothing_acknowledged(session):
    """An unknown event id is reported as not acknowledged."""
    repository = SqlAlchemyAlertEventRepository(session)

    assert (
        repository.acknowledge_event(
            404, datetime(2026, 11, 11, 13, 0, tzinfo=timezone.utc)
        )
        is False
    )
