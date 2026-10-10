"""Tests for currency-aware valuation and configurable target alerts."""

from decimal import Decimal

import pytest

from backend.app.domain.alerts import AlertIntent, evaluate_target_alert
from backend.app.domain.portfolio import PortfolioPosition
from backend.app.domain.valuation import value_portfolio


def position(ticker: str, quantity: str, average: str, currency: str):
    """Create a position for deterministic valuation tests."""
    return PortfolioPosition(
        ticker=ticker,
        broker="Broker A",
        category="Acciones",
        quantity=Decimal(quantity),
        average_price=Decimal(average),
        currency=currency,
    )


def test_portfolio_totals_are_grouped_by_currency():
    """Valuation aggregates same-currency positions without combining currencies."""
    totals = value_portfolio(
        [
            position("AAPL", "2", "10", "USD"),
            position("MSFT", "1", "20", "USD"),
            position("GGAL", "2", "1000", "ARS"),
        ],
        {"AAPL": Decimal("12"), "MSFT": Decimal("18"), "GGAL": Decimal("900")},
    )

    assert set(totals) == {"USD", "ARS"}
    assert totals["USD"].invested_value == Decimal("40")
    assert totals["USD"].market_value == Decimal("42")
    assert totals["USD"].gain_loss == Decimal("2")
    assert totals["USD"].gain_loss_percent == Decimal("5")
    assert totals["ARS"].invested_value == Decimal("2000")
    assert totals["ARS"].market_value == Decimal("1800")
    assert totals["ARS"].gain_loss == Decimal("-200")
    assert totals["ARS"].gain_loss_percent == Decimal("-10")


def test_missing_market_price_is_not_valued_as_zero():
    """An unavailable quote marks totals unknown instead of creating a loss."""
    totals = value_portfolio([position("AAPL", "2", "10", "USD")], {})

    assert totals["USD"].invested_value == Decimal("20")
    assert totals["USD"].market_value is None
    assert totals["USD"].gain_loss is None
    assert totals["USD"].gain_loss_percent is None
    assert totals["USD"].unpriced_tickers == ("AAPL",)


@pytest.mark.parametrize(
    ("previous", "current", "intent", "expected_message"),
    [
        (Decimal("9"), Decimal("10"), AlertIntent.NEUTRAL, "Precio objetivo alcanzado."),
        (Decimal("11"), Decimal("10"), AlertIntent.NEUTRAL, "Precio objetivo alcanzado."),
        (Decimal("11"), Decimal("10"), AlertIntent.BUY, "Precio objetivo de compra alcanzado."),
        (Decimal("11"), Decimal("10"), AlertIntent.STOP_LOSS, "Stop-loss alcanzado."),
        (Decimal("9"), Decimal("10"), AlertIntent.SELL, "Precio objetivo de venta alcanzado."),
    ],
)
def test_target_alert_emits_intent_message_on_configured_crossing(
    previous, current, intent, expected_message
):
    """A target crossing emits only the configured intent's message."""
    event = evaluate_target_alert(previous, current, Decimal("10"), intent)

    assert event is not None
    assert event.intent is intent
    assert event.message == expected_message


@pytest.mark.parametrize(
    ("previous", "current", "intent"),
    [
        (Decimal("9"), Decimal("10"), AlertIntent.BUY),
        (Decimal("11"), Decimal("10"), AlertIntent.SELL),
        (Decimal("10"), Decimal("9"), AlertIntent.NEUTRAL),
    ],
)
def test_wrong_direction_or_no_cross_does_not_emit_alert(previous, current, intent):
    """A target emits no event when its direction does not cross the threshold."""
    assert evaluate_target_alert(previous, current, Decimal("10"), intent) is None


def test_remaining_beyond_target_does_not_repeat_crossing():
    """Subsequent prices on the same side do not produce duplicate crossings."""
    assert (
        evaluate_target_alert(
            Decimal("9"), Decimal("10"), Decimal("10"), AlertIntent.NEUTRAL
        )
        is not None
    )
    assert (
        evaluate_target_alert(
            Decimal("10"), Decimal("11"), Decimal("10"), AlertIntent.NEUTRAL
        )
        is None
    )
