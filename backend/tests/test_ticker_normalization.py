"""Contract tests for canonical ticker normalization and its domain adoption."""

from decimal import Decimal

import pytest

from backend.app.domain.analysis import analyze_market
from backend.app.domain.portfolio import PortfolioPosition
from backend.app.domain.tickers import MAX_TICKER_LENGTH, normalize_ticker

OVER_LONG_TICKER = "A" * (MAX_TICKER_LENGTH + 1)


def position(**overrides) -> PortfolioPosition:
    """Build a valid position so each test overrides exactly one field."""
    values = {
        "ticker": "AAPL",
        "broker": "Broker A",
        "category": "Acciones",
        "quantity": Decimal("1"),
        "average_price": Decimal("10"),
        "currency": "USD",
    }
    values.update(overrides)
    return PortfolioPosition(**values)


@pytest.mark.parametrize("raw", ["aapl", " AAPL ", "  aapl  "])
def test_normalize_ticker_returns_the_canonical_symbol(raw):
    """Normalization strips surrounding whitespace and upper-cases the symbol."""
    assert normalize_ticker(raw) == "AAPL"


def test_normalize_ticker_accepts_a_symbol_at_the_length_limit():
    """A symbol exactly at the limit is valid."""
    ticker = "A" * MAX_TICKER_LENGTH

    assert normalize_ticker(ticker) == ticker


@pytest.mark.parametrize("raw", ["", "   ", "\t\n"])
def test_normalize_ticker_rejects_a_blank_symbol(raw):
    """A symbol that is empty after stripping is rejected."""
    with pytest.raises(ValueError, match="ticker is required"):
        normalize_ticker(raw)


def test_normalize_ticker_rejects_a_symbol_over_the_length_limit():
    """A symbol longer than the limit is rejected with the limit in the message."""
    with pytest.raises(ValueError, match="ticker must be at most 32 characters"):
        normalize_ticker(OVER_LONG_TICKER)


def test_position_rejects_a_symbol_over_the_length_limit():
    """A position no longer accepts a symbol the database column cannot hold."""
    with pytest.raises(ValueError, match="ticker must be at most 32 characters"):
        position(ticker=OVER_LONG_TICKER)


def test_position_still_normalizes_its_symbol():
    """Position normalization is unchanged for valid input."""
    assert position(ticker=" aapl ").ticker == "AAPL"


def test_position_keeps_its_existing_message_for_a_missing_broker():
    """The broker and category rejection message is byte-identical to before."""
    with pytest.raises(ValueError, match="ticker, broker, and category are required"):
        position(broker="   ")


def test_analysis_rejects_a_symbol_over_the_length_limit():
    """Market analysis validates through the same canonical rule."""
    with pytest.raises(ValueError, match="ticker must be at most 32 characters"):
        analyze_market(OVER_LONG_TICKER, Decimal("10"), ())


def test_analysis_still_normalizes_a_valid_symbol():
    """Analysis keeps returning the canonical symbol for valid input."""
    assert analyze_market(" aapl ", Decimal("10"), ()).ticker == "AAPL"
