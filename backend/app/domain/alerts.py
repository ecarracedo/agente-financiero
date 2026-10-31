"""Pure configurable target-alert crossing rules."""

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class AlertIntent(str, Enum):
    """Supported meanings for a configured target price."""

    NEUTRAL = "NEUTRAL"
    STOP_LOSS = "STOP_LOSS"
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


_MESSAGES = {
    AlertIntent.NEUTRAL: "Precio objetivo alcanzado.",
    AlertIntent.STOP_LOSS: "Stop-loss alcanzado.",
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

    Neutral alerts trigger in either direction; buy and stop-loss alerts
    trigger downward, and sell alerts trigger upward. A price remaining on
    the same side of the target is not a crossing and produces no repeat.

    Args:
        previous_price: The quote immediately before the current quote.
        current_price: The latest quote.
        target_price: Configured target threshold.
        intent: User-selected meaning and direction for the target.

    Returns:
        An intent-specific event for a valid crossing, otherwise ``None``.
    """
    if target_price <= 0 or previous_price < 0 or current_price < 0:
        raise ValueError("prices must be non-negative and target must be positive")

    crossed_down = previous_price > target_price >= current_price
    crossed_up = previous_price < target_price <= current_price

    triggered = (
        (intent is AlertIntent.NEUTRAL and (crossed_down or crossed_up))
        or (intent in (AlertIntent.STOP_LOSS, AlertIntent.BUY) and crossed_down)
        or (intent is AlertIntent.SELL and crossed_up)
    )
    if not triggered:
        return None
    return TargetAlertEvent(intent=intent, message=_MESSAGES[intent])
