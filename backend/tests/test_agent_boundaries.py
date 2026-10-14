"""Configuration, lazy-import and provider-failure boundaries for the agent."""

import dataclasses
import importlib
import sys
from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.adapters.persistence.models import Base
from backend.app.adapters.persistence.unit_of_work import SqlAlchemyPortfolioUnitOfWork
from backend.app.agents.config import AgentConfigurationError, AgentSettings
from backend.app.agents.service import (
    ANSWER_STATUS_ANSWERED,
    ANSWER_STATUS_UNAVAILABLE,
    READ_ONLY_SYSTEM_PROMPT,
    UNAVAILABLE_MESSAGE,
    AgentAnswer,
    build_agent_service,
)
from backend.app.agents.tools import (
    READ_ONLY_TOOL_NAMES,
    FinancialReadTools,
    ToolNotPermittedError,
    build_tool_registry,
)
from backend.app.application.analytics import PortfolioAnalyticsUseCases
from backend.app.application.portfolio import PortfolioUseCases

ENVIRONMENT = {
    "AGENT_MODEL_ID": "anthropic.claude-sonnet-4-6",
    "AWS_REGION": "us-east-1",
}


class FakeMarketDataProvider:
    """Provide a provider that has no market data at all."""

    def get_current_price(self, ticker):
        """Return no quote."""
        return None

    def get_historical_series(self, ticker, period):
        """Return no dated points."""
        return ()


class StubRuntime:
    """Return a fixed message without contacting any provider."""

    def __init__(self, message="grounded answer"):
        """Store the message this runtime answers with."""
        self._message = message

    def run(self, prompt):
        """Return the stored message."""
        return self._message


class FailingRuntime:
    """Raise the way an unavailable provider would."""

    def run(self, prompt):
        """Raise the provider failure."""
        raise RuntimeError("provider unavailable")


def build_services():
    """Build the real read-only use cases over an isolated in-memory database."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    def unit_of_work_factory():
        """Create a unit of work bound to the isolated engine."""
        return SqlAlchemyPortfolioUnitOfWork(sessionmaker(bind=engine))

    portfolio = PortfolioUseCases(unit_of_work_factory)
    return (
        engine,
        portfolio,
        PortfolioAnalyticsUseCases(portfolio, FakeMarketDataProvider()),
    )


def snapshot_database(engine):
    """Return every row of every table so any mutation would be visible."""
    with Session(engine) as session:
        tables = sorted(Base.metadata.tables.values(), key=lambda table: table.name)
        return {
            table.name: tuple(str(row) for row in session.execute(select(table)).all())
            for table in tables
        }


def stub_runtime_factory(message="grounded answer"):
    """Return a runtime factory that answers with a fixed message."""

    def factory(tools, system_prompt):
        """Return a stub runtime."""
        return StubRuntime(message)

    return factory


def block_strands(monkeypatch):
    """Make every Strands import fail, as if the dependency were absent."""
    for module_name in ("strands", "strands.models", "strands.models.bedrock"):
        monkeypatch.setitem(sys.modules, module_name, None)


def test_settings_come_from_the_environment():
    """The model and region are read from the environment and trimmed."""
    settings = AgentSettings.from_environment(
        {
            "AGENT_MODEL_ID": "  anthropic.claude-sonnet-4-6  ",
            "AWS_REGION": " us-east-1 ",
        }
    )

    assert settings == AgentSettings(
        model_id="anthropic.claude-sonnet-4-6", region="us-east-1"
    )
    assert {field.name for field in dataclasses.fields(AgentSettings)} == {
        "model_id",
        "region",
    }


def test_missing_or_blank_settings_are_a_configuration_error():
    """Incomplete configuration is refused instead of defaulted silently."""
    incomplete_environments = (
        {},
        {"AGENT_MODEL_ID": "anthropic.claude-sonnet-4-6"},
        {"AWS_REGION": "us-east-1"},
        {"AGENT_MODEL_ID": "   ", "AWS_REGION": "us-east-1"},
    )

    for environment in incomplete_environments:
        with pytest.raises(AgentConfigurationError):
            AgentSettings.from_environment(environment)


def test_agent_package_imports_without_strands_installed(monkeypatch):
    """Strands is imported lazily, so the module re-imports when it is absent."""
    block_strands(monkeypatch)

    runtime_module = importlib.reload(
        importlib.import_module("backend.app.agents.runtime")
    )

    assert callable(runtime_module.create_strands_runtime)
    with pytest.raises(runtime_module.StrandsUnavailableError):
        runtime_module.create_strands_runtime(
            (), "policy", AgentSettings(model_id="model", region="region")
        )


def test_asking_without_strands_reports_uncertainty(monkeypatch):
    """A missing provider is reported as uncertainty, never as an invented price."""
    block_strands(monkeypatch)
    _, portfolio, analytics = build_services()
    service = build_agent_service(portfolio, analytics, environment=ENVIRONMENT)

    answer = service.ask("how are my holdings doing?")

    assert answer.status == ANSWER_STATUS_UNAVAILABLE
    assert answer.message == UNAVAILABLE_MESSAGE


def test_only_the_allowlisted_tools_reach_the_runtime():
    """The runtime is handed the four approved reads and the read-only policy."""
    recorded = {}

    def runtime_factory(tools, system_prompt):
        """Record the tools and policy, then return a stub runtime."""
        recorded["tools"] = tools
        recorded["system_prompt"] = system_prompt
        return StubRuntime()

    _, portfolio, analytics = build_services()
    service = build_agent_service(
        portfolio,
        analytics,
        environment=ENVIRONMENT,
        runtime_factory=runtime_factory,
    )

    answer = service.ask("summarize my portfolio")

    assert answer == AgentAnswer(
        status=ANSWER_STATUS_ANSWERED, message="grounded answer"
    )
    assert {callable_.__name__ for callable_ in recorded["tools"]} == set(
        READ_ONLY_TOOL_NAMES
    )
    assert recorded["system_prompt"] == READ_ONLY_SYSTEM_PROMPT
    assert "read-only" in READ_ONLY_SYSTEM_PROMPT
    assert "confirm" in READ_ONLY_SYSTEM_PROMPT


def test_provider_failure_returns_uncertainty_without_inventing_a_price():
    """A failing provider yields an unavailable answer and no estimated data."""
    _, portfolio, analytics = build_services()
    service = build_agent_service(
        portfolio,
        analytics,
        environment=ENVIRONMENT,
        runtime_factory=lambda tools, system_prompt: FailingRuntime(),
    )

    answer = service.ask("what is my portfolio worth?")

    assert answer.status == ANSWER_STATUS_UNAVAILABLE
    assert answer.message == UNAVAILABLE_MESSAGE


def test_a_mutation_request_changes_no_record_and_grants_no_mutating_tool():
    """Asking the agent to buy, sell, delete or alter changes nothing at all."""
    engine, portfolio, analytics = build_services()
    portfolio.record_purchase(
        ticker="AAPL",
        broker="Broker A",
        category="Acciones",
        quantity=Decimal("10"),
        unit_price=Decimal("150"),
        currency="USD",
        occurred_at=datetime(2024, 1, 2),
    )
    before = snapshot_database(engine)
    service = build_agent_service(
        portfolio,
        analytics,
        environment=ENVIRONMENT,
        runtime_factory=stub_runtime_factory("refused"),
    )
    registry = build_tool_registry(FinancialReadTools(portfolio, analytics))

    answer = service.ask("sell all my AAPL shares and delete the purchase record")

    assert answer.status == ANSWER_STATUS_ANSWERED
    assert snapshot_database(engine) == before
    with pytest.raises(ToolNotPermittedError):
        registry.invoke("delete_transaction", transaction_id=1)
    with pytest.raises(ToolNotPermittedError):
        registry.invoke("record_sale", ticker="AAPL")
    assert snapshot_database(engine) == before
