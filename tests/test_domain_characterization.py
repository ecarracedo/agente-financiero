"""Characterization tests for existing portfolio and analysis behavior."""

from datetime import date

import pandas as pd

from src.models.database import PortfolioItem
from src.services.analyzer import analyze_stock
from src.services.portfolio import Portfolio


def test_deleting_sale_rebuilds_remaining_position(isolated_database):
    """Deleting a sale restores holdings from the remaining transaction history."""
    portfolio = Portfolio()
    ticker = "TEST_REBUILD"
    broker = "TEST_BROKER"

    portfolio.update_position(ticker, 10, 100.0, broker, date(2024, 1, 1))
    portfolio.update_position(ticker, 10, 200.0, broker, date(2024, 1, 2))
    portfolio.update_position(ticker, -10, 150.0, broker, date(2024, 1, 3))

    sale = next(
        transaction
        for transaction in portfolio.get_transactions()
        if transaction["operation_type"] == "Venta"
    )

    assert portfolio.delete_transaction(sale["id"]) is True

    position = PortfolioItem.get(
        (PortfolioItem.ticker == ticker) & (PortfolioItem.broker == broker)
    )
    assert position.quantity == 20
    assert position.avg_price == 150.0
    assert len(portfolio.get_transactions()) == 2


def test_deleting_unknown_transaction_preserves_position(isolated_database):
    """Deleting an unknown transaction leaves the current holding unchanged."""
    portfolio = Portfolio()
    ticker = "TEST_MISSING_TX"
    broker = "TEST_BROKER"
    portfolio.update_position(ticker, 3, 12.5, broker, date(2024, 1, 1))

    assert portfolio.delete_transaction(-1) is False

    position = PortfolioItem.get(
        (PortfolioItem.ticker == ticker) & (PortfolioItem.broker == broker)
    )
    assert position.quantity == 3
    assert position.avg_price == 12.5
    assert len(portfolio.get_transactions()) == 1


def test_analyzer_reports_missing_history():
    """Empty market history produces an explicit unknown analysis."""
    result = analyze_stock("TEST", 12.0, pd.DataFrame())

    assert result == {"status": "Unknown", "reason": "No historical data"}


def test_analyzer_calculates_52_week_range_and_moving_averages():
    """Market analysis calculates range and rolling averages from close prices."""
    history = pd.DataFrame({"Close": [10.0] * 199 + [20.0]})

    result = analyze_stock("TEST", 20.0, history)

    assert result["high_52w"] == 20.0
    assert result["low_52w"] == 10.0
    assert result["ma_50"] == 10.2
    assert result["ma_200"] == 10.05
    assert any("Near 52-week High" in signal for signal in result["signals"])
    assert any("Above 200-day MA" in signal for signal in result["signals"])


def test_analyzer_identifies_price_below_200_day_average():
    """A current price below the rolling 200-day average yields a bearish signal."""
    history = pd.DataFrame({"Close": [10.0] * 200})

    result = analyze_stock("TEST", 5.0, history)

    assert result["ma_200"] == 10.0
    assert any("Below 200-day MA" in signal for signal in result["signals"])
