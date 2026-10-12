"""Tests for backend market-analysis signals."""

from datetime import date, timedelta
from decimal import Decimal

from backend.app.domain.analysis import PricePoint, analyze_market


def points(closes):
    """Build a chronological series of dated price points for analysis tests."""
    return [
        PricePoint(date=date(2024, 1, 1) + timedelta(days=index), close=close)
        for index, close in enumerate(closes)
    ]


def test_analysis_reports_range_moving_averages_and_signals():
    """Analysis reports rolling averages and proximity signals from closes."""
    closes = [Decimal("10")] * 199 + [Decimal("20")]

    result = analyze_market("AAPL", Decimal("20"), points(closes))

    assert result.ticker == "AAPL"
    assert result.high_52_week == Decimal("20")
    assert result.low_52_week == Decimal("10")
    assert result.moving_average_50 == Decimal("10.2")
    assert result.moving_average_200 == Decimal("10.05")
    assert "NEAR_52_WEEK_HIGH" in result.signals
    assert "ABOVE_200_DAY_AVERAGE" in result.signals


def test_analysis_preserves_the_dated_series():
    """The analysis carries the chronological dated series alongside the metrics."""
    series = points([Decimal("10"), Decimal("11"), Decimal("12")])

    result = analyze_market("AAPL", Decimal("12"), series)

    assert result.series == tuple(series)
    assert [point.close for point in result.series] == [
        Decimal("10"),
        Decimal("11"),
        Decimal("12"),
    ]


def test_analysis_orders_the_series_chronologically():
    """An out-of-order provider series is normalized oldest to newest."""
    series = points([Decimal("10"), Decimal("20"), Decimal("30")])

    result = analyze_market("AAPL", Decimal("30"), list(reversed(series)))

    assert [point.date for point in result.series] == [point.date for point in series]


def test_analysis_returns_unknown_and_empty_series_for_empty_history():
    """Missing history yields an explicit unknown result with no series."""
    result = analyze_market("AAPL", Decimal("20"), [])

    assert result.status == "UNKNOWN"
    assert result.reason == "No historical data"
    assert result.high_52_week is None
    assert result.moving_average_200 is None
    assert result.series == ()


def test_analysis_keeps_unknown_state_without_a_current_price():
    """A missing current quote preserves the unknown state and carries no series."""
    result = analyze_market("AAPL", None, points([Decimal("10")]))

    assert result.status == "UNKNOWN"
    assert result.reason == "No current market price"
    assert result.series == ()


def test_analysis_omits_average_signal_when_history_is_too_short():
    """An unavailable 200-day average does not produce a false bullish signal."""
    result = analyze_market("AAPL", Decimal("12"), points([Decimal("10")] * 50))

    assert result.moving_average_50 == Decimal("10")
    assert result.moving_average_200 is None
    assert "ABOVE_200_DAY_AVERAGE" not in result.signals
    assert "BELOW_200_DAY_AVERAGE" not in result.signals
