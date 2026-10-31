"""Canonical Decimal serialization shared by the versioned API schemas.

Serialization is the only layer allowed to quantize money: the persistence
scale (``Numeric(30, 10)``) and all domain arithmetic stay untouched so that
sums of parts keep matching their totals.
"""

from decimal import ROUND_HALF_UP, Decimal, localcontext
from typing import Annotated

from pydantic import PlainSerializer

_MONEY_QUANTUM = Decimal("0.01")
# A ``Numeric(30, 10)`` value can carry 30 significant digits, which exceeds the
# default decimal precision of 28. Widen the context so quantizing money never
# raises ``InvalidOperation`` on large persisted amounts.
_QUANTIZE_PRECISION = 60


def _canonicalize(value: Decimal) -> str:
    """Render a Decimal without trailing zeros, exponent, or negative zero.

    Args:
        value: A finite Decimal value.

    Returns:
        A plain fixed-point string such as ``"30"`` or ``"2.5"``.
    """
    if value == 0:
        return "0"
    return format(value.normalize(), "f")


def format_money(value: Decimal) -> str:
    """Quantize a monetary amount to two decimals and canonicalize it.

    Rounding uses ``ROUND_HALF_UP`` and happens only at output serialization.

    Args:
        value: A Decimal currency amount.

    Returns:
        A canonical string with at most two decimal places, e.g. ``"30"``,
        ``"2.5"``, or ``"2.57"``.
    """
    with localcontext() as context:
        context.prec = _QUANTIZE_PRECISION
        quantized = value.quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    return _canonicalize(quantized)


def format_quantity(value: Decimal) -> str:
    """Canonicalize a unit quantity without capping its precision.

    Args:
        value: A Decimal quantity that may carry fractional units.

    Returns:
        A canonical string such as ``"2.5"`` or ``"0.3333333333"``.
    """
    return _canonicalize(value)


MoneyString = Annotated[
    Decimal, PlainSerializer(format_money, return_type=str, when_used="json")
]
QuantityString = Annotated[
    Decimal, PlainSerializer(format_quantity, return_type=str, when_used="json")
]
OptionalMoneyString = MoneyString | None
