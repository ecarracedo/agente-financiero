"""Pure configurable target-alert crossing rules."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum


class AlertIntent(str, Enum):
    """Trade direction a configured target price is waiting for."""

    BUY = "BUY"
    SELL = "SELL"


@dataclass(frozen=True)
class TargetAlertEvent:
    """Represent one intent-specific target crossing notification."""

    intent: AlertIntent
    message: str


@dataclass(frozen=True)
class TargetAlertSettings:
    """Persistable target intent and previous observation for crossing checks."""

    target_price: Decimal
    intent: AlertIntent
    last_observed_price: Decimal | None = None

    def __post_init__(self) -> None:
        """Validate target settings without assigning defaults to legacy rows."""
        if self.target_price <= 0:
            raise ValueError("target price must be positive")
        if self.last_observed_price is not None and self.last_observed_price < 0:
            raise ValueError("last observed price must be non-negative")


class AlertScope(str, Enum):
    """Which collection a monitored asset belongs to."""

    PORTFOLIO = "portfolio"
    WISHLIST = "wishlist"


@dataclass(frozen=True)
class ConfiguredAlert:
    """One configured alert with the identity of the asset it watches.

    A read projection: ``broker``, ``category`` and ``currency`` describe a
    portfolio position and stay ``None`` for a wishlist entry, which carries no
    such attributes.
    """

    scope: AlertScope
    ticker: str
    target_price: Decimal
    intent: AlertIntent
    broker: str | None = None
    category: str | None = None
    currency: str | None = None
    last_observed_price: Decimal | None = None


@dataclass(frozen=True)
class TriggeredAlert:
    """One detected crossing, kept so the user sees what fired while away.

    A read projection of a persisted event: it copies the asset identity of the
    alert that fired plus the price that crossed it. ``acknowledged_at`` is set
    once the user has seen it; acknowledging never deletes the alert.
    """

    id: int
    scope: AlertScope
    ticker: str
    target_price: Decimal
    intent: AlertIntent
    observed_price: Decimal
    message: str
    triggered_at: datetime
    broker: str | None = None
    category: str | None = None
    currency: str | None = None
    acknowledged_at: datetime | None = None


_MESSAGES = {
    AlertIntent.BUY: "Precio objetivo de compra alcanzado.",
    AlertIntent.SELL: "Precio objetivo de venta alcanzado.",
}


def evaluate_target_alert(
    previous_price: Decimal,
    current_price: Decimal,
    target_price: Decimal,
    intent: AlertIntent,
) -> TargetAlertEvent | None:
    """Return an alert only when consecutive prices cross its target.

    A buy alert triggers downward and a sell alert triggers upward. A price
    remaining on the same side of the target is not a crossing and produces no
    repeat.

    Args:
        previous_price: The quote immediately before the current quote.
        current_price: The latest quote.
        target_price: Configured target threshold.
        intent: Trade direction the target is waiting for.

    Returns:
        An intent-specific event for a valid crossing, otherwise ``None``.
    """
    if target_price <= 0 or previous_price < 0 or current_price < 0:
        raise ValueError("prices must be non-negative and target must be positive")

    crossed_down = previous_price > target_price >= current_price
    crossed_up = previous_price < target_price <= current_price

    triggered = (intent is AlertIntent.BUY and crossed_down) or (
        intent is AlertIntent.SELL and crossed_up
    )
    if not triggered:
        return None
    return TargetAlertEvent(intent=intent, message=_MESSAGES[intent])
