"""Read-only tool allowlist, serialization and no-write coverage for the agent."""

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pytest

from backend.app.agents.tools import (
    READ_ONLY_TOOL_NAMES,
    FinancialReadTools,
    ToolNotPermittedError,
    build_tool_registry,
)
from backend.app.domain.analysis import PricePoint
from backend.tests.agent_support import FakeMarketDataProvider, build_read_use_cases

WRITE_USE_CASE_NAMES = (
    "record_purchase",
    "record_sale",
    "delete_transaction",
    "add_wishlist_item",
    "update_wishlist_target",
    "remove_wishlist_item",
    "add_bibliography_item",
    "delete_bibliography_item",
)


def build_tools(provider):
    """Build the financial read tools plus the isolated database engine."""
    engine, portfolio, analytics = build_read_use_cases(provider)
    return engine, portfolio, FinancialReadTools(portfolio, analytics)


def test_read_tools_return_serialized_portfolio_data():
    """Every allowlisted tool returns JSON-ready data taken from real records."""
    provider = FakeMarketDataProvider(
        prices={"AAPL": Decimal("190.5")},
        series={
            "AAPL": (
                PricePoint(date=date(2024, 1, 2), close=Decimal("188")),
                PricePoint(date=date(2024, 1, 3), close=Decimal("191")),
            )
        },
    )
    _, portfolio, tools = build_tools(provider)
    portfolio.record_purchase(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("10"),
        unit_price=Decimal("150"),
        currency="USD",
        occurred_at=datetime(2024, 1, 2),
    )

    positions = tools.read_portfolio()
    valuations = tools.read_valuations()
    history = tools.read_history(ticker="aapl", broker="Broker A")
    analysis = tools.read_market_analysis(ticker="aapl", period="6m")

    position = positions["positions"][0]
    assert position["ticker"] == "AAPL"
    assert position["broker"] == "Broker A"
    assert position["category"] == "Acciones"
    assert position["currency"] == "USD"
    assert isinstance(position["quantity"], str)
    assert Decimal(position["quantity"]) == Decimal("10")
    assert isinstance(position["average_price"], str)
    assert Decimal(position["average_price"]) == Decimal("150")
    valuation = valuations["valuations"][0]
    assert valuation["currency"] == "USD"
    assert Decimal(valuation["invested_value"]) == Decimal("1500")
    assert Decimal(valuation["market_value"]) == Decimal("1905.0")
    assert valuation["unpriced_tickers"] == []
    assert set(history["history"][0]) == {
        "id",
        "ticker",
        "broker",
        "category",
        "operation_type",
        "quantity",
        "unit_price",
        "currency",
        "occurred_at",
    }
    assert history["history"][0]["ticker"] == "AAPL"
    assert Decimal(history["history"][0]["quantity"]) == Decimal("10")
    assert analysis["ticker"] == "AAPL"
    assert Decimal(analysis["current_price"]) == Decimal("190.5")
    assert Decimal(analysis["high_52_week"]) == Decimal("191")
    assert analysis["series"] == [
        {"date": "2024-01-02", "close": "188"},
        {"date": "2024-01-03", "close": "191"},
    ]
    assert provider.requested_periods == ["6m"]


def test_read_tools_report_missing_market_data_without_inventing_prices():
    """A provider with no data yields explicit absence instead of a made-up quote."""
    _, _, tools = build_tools(FakeMarketDataProvider())

    analysis = tools.read_market_analysis(ticker="MSFT")

    assert analysis["current_price"] is None
    assert analysis["high_52_week"] is None
    assert analysis["series"] == []
    assert tools.read_valuations() == {"valuations": []}


def test_allowlist_is_exactly_the_read_only_tools():
    """The registry exposes the four approved reads and no write capability."""
    _, _, tools = build_tools(FakeMarketDataProvider())

    registry = build_tool_registry(tools)

    assert READ_ONLY_TOOL_NAMES == (
        "read_portfolio",
        "read_valuations",
        "read_market_analysis",
        "read_history",
    )
    assert registry.names == READ_ONLY_TOOL_NAMES
    assert {callable_.__name__ for callable_ in registry.callables()} == set(
        READ_ONLY_TOOL_NAMES
    )
    for write_name in WRITE_USE_CASE_NAMES:
        assert not hasattr(tools, write_name)


def test_invoking_a_tool_outside_the_allowlist_is_refused():
    """A tool that is not on the allowlist cannot be selected at all."""
    _, _, tools = build_tools(FakeMarketDataProvider())
    registry = build_tool_registry(tools)

    with pytest.raises(ToolNotPermittedError):
        registry.invoke("record_purchase", ticker="AAPL")


def test_agent_modules_reach_no_sql_or_database_handle():
    """The agent layer holds no SQLAlchemy dependency and no database handle."""
    agent_directory = Path(__file__).resolve().parents[1] / "app" / "agents"
    sources = "".join(
        path.read_text(encoding="utf-8")
        for path in sorted(agent_directory.glob("*.py"))
    )

    for forbidden in ("sqlalchemy", "create_engine", "sessionmaker", "Session("):
        assert forbidden not in sources
