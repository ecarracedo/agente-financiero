"""Argentine dollar rates computed with the RAVA methodology.

MEP is the ARS bond price over its USD local-settlement twin
(GD30 / GD30D). CCL is the ARS Cedear price over the foreign share
price, scaled by the BYMA Cedear ratio (AAPL 20:1 since 2024-01-24).
A missing or non-positive leg yields no rate rather than a guess.
"""

from decimal import Decimal

# BYMA Cedear ratio for AAPL (20 Cedears = 1 NASDAQ share).
AAPL_CEDear_RATIO = Decimal("20")


def compute_mep(ars_price: Decimal | None, usd_price: Decimal | None) -> Decimal | None:
    """Return the MEP implied by an ARS/USD bond pair, or None."""
    if ars_price is None or usd_price is None or usd_price <= 0:
        return None
    return ars_price / usd_price


def compute_ccl(
    cedear_ars: Decimal | None,
    adr_usd: Decimal | None,
    ratio: Decimal = AAPL_CEDear_RATIO,
) -> Decimal | None:
    """Return the CCL implied by a Cedear/ADR pair, or None."""
    if cedear_ars is None or adr_usd is None or adr_usd <= 0:
        return None
    return cedear_ars * ratio / adr_usd
