"""Tests for backend market-analysis signals."""

from decimal import Decimal

from backend.app.domain.analysis import analyze_market


def test_analysis_reports_range_moving_averages_and_signals():
    """Analysis reports rolling averages and proximity signals from closes."""
    closes = [Decimal("10")] * 199 + [Decimal("20")]

    result = analyze_market("AAPL", Decimal("20"), closes)

    assert result.ticker == "AAPL"
    assert result.high_52_week == Decimal("20")
    assert result.low_52_week == Decimal("10")
    assert result.moving_average_50 == Decimal("10.2")
    assert result.moving_average_200 == Decimal("10.05")
    assert "NEAR_52_WEEK_HIGH" in result.signals
    assert "ABOVE_200_DAY_AVERAGE" in result.signals


def test_analysis_returns_unknown_for_empty_history():
    """Missing history yields an explicit unknown result."""
    result = analyze_market("AAPL", Decimal("20"), [])

    assert result.status == "UNKNOWN"
    assert result.reason == "No historical data"
    assert result.high_52_week is None
    assert result.moving_average_200 is None


def test_analysis_omits_average_signal_when_history_is_too_short():
    """An unavailable 200-day average does not produce a false bullish signal."""
    result = analyze_market("AAPL", Decimal("12"), [Decimal("10")] * 50)

    assert result.moving_average_50 == Decimal("10")
    assert result.moving_average_200 is None
    assert "ABOVE_200_DAY_AVERAGE" not in result.signals
    assert "BELOW_200_DAY_AVERAGE" not in result.signals
