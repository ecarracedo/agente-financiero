"""Pure technical market analysis using Decimal prices."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class PricePoint:
    """A dated closing price used to build the historical price series."""

    date: date
    close: Decimal


@dataclass(frozen=True)
class MarketAnalysis:
    """Represent market range, rolling averages, explicit signals, and series."""

    ticker: str
    status: str
    reason: str | None
    current_price: Decimal | None
    high_52_week: Decimal | None
    low_52_week: Decimal | None
    moving_average_50: Decimal | None
    moving_average_200: Decimal | None
    signals: tuple[str, ...]
    series: tuple[PricePoint, ...]


def analyze_market(
    ticker: str,
    current_price: Decimal | None,
    series: Sequence[PricePoint],
) -> MarketAnalysis:
    """Calculate range, moving-average signals, and a dated series.

    The 52-week range uses the available supplied closes. A rolling average is
    reported only when its complete window is available. Missing history yields
    an explicit unknown result rather than a zero-valued market signal. The
    returned series is normalized to chronological (oldest to newest) order.

    Args:
        ticker: Asset symbol being analyzed.
        current_price: Latest available market price, or ``None`` if unavailable.
        series: Historical dated closing prices supplied by the market-data port.

    Returns:
        A typed analysis result with optional metrics and a dated series.

    Raises:
        ValueError: If the ticker is empty or the current price is not positive.
    """
    normalized_ticker = ticker.strip().upper()
    if not normalized_ticker:
        raise ValueError("ticker is required")
    if current_price is None:
        return MarketAnalysis(
            ticker=normalized_ticker,
            status="UNKNOWN",
            reason="No current market price",
            current_price=None,
            high_52_week=None,
            low_52_week=None,
            moving_average_50=None,
            moving_average_200=None,
            signals=(),
            series=(),
        )
    if current_price <= 0:
        raise ValueError("current price must be positive")

    if not series:
        return MarketAnalysis(
            ticker=normalized_ticker,
            status="UNKNOWN",
            reason="No historical data",
            current_price=current_price,
            high_52_week=None,
            low_52_week=None,
            moving_average_50=None,
            moving_average_200=None,
            signals=(),
            series=(),
        )

    ordered_series = tuple(sorted(series, key=lambda point: point.date))
    closing_prices = [point.close for point in ordered_series]

    high_52_week = max(closing_prices)
    low_52_week = min(closing_prices)
    moving_average_50 = (
        sum(closing_prices[-50:], Decimal("0")) / Decimal("50")
        if len(closing_prices) >= 50
        else None
    )
    moving_average_200 = (
        sum(closing_prices[-200:], Decimal("0")) / Decimal("200")
        if len(closing_prices) >= 200
        else None
    )

    signals: list[str] = []
    if current_price <= low_52_week * Decimal("1.05"):
        signals.append("NEAR_52_WEEK_LOW")
    elif current_price >= high_52_week * Decimal("0.95"):
        signals.append("NEAR_52_WEEK_HIGH")

    if moving_average_200 is not None:
        if current_price < moving_average_200:
            signals.append("BELOW_200_DAY_AVERAGE")
        else:
            signals.append("ABOVE_200_DAY_AVERAGE")

    return MarketAnalysis(
        ticker=normalized_ticker,
        status="OK",
        reason=None,
        current_price=current_price,
        high_52_week=high_52_week,
        low_52_week=low_52_week,
        moving_average_50=moving_average_50,
        moving_average_200=moving_average_200,
        signals=tuple(signals),
        series=ordered_series,
    )
