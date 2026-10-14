"""Orchestrate the read-only financial agent behind its tool allowlist."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from backend.app.agents.config import AgentSettings
from backend.app.agents.runtime import create_strands_runtime
from backend.app.agents.tools import (
    FinancialReadTools,
    ToolRegistry,
    build_tool_registry,
)
from backend.app.application.analytics import PortfolioAnalyticsUseCases
from backend.app.application.portfolio import PortfolioUseCases

ANSWER_STATUS_ANSWERED = "answered"
ANSWER_STATUS_UNAVAILABLE = "unavailable"
UNAVAILABLE_MESSAGE = "the data is unavailable, so no price or signal can be reported"

READ_ONLY_SYSTEM_PROMPT = (
    "You are a read-only financial analysis assistant. "
    "Answer only with the read-only tools you are given, and never state a price, "
    "signal or total that those tools did not return. "
    "You cannot buy, sell, delete or alter any record: if the user asks for a "
    "mutation, refuse it and ask them to confirm the action outside the agent. "
    "When a tool reports missing or unavailable data, say that the data is "
    "unavailable instead of estimating it."
)


class AgentRuntimePort(Protocol):
    """Run one prompt with the tools the service has approved."""

    def run(self, prompt: str) -> str:
        """Return the answer text for one prompt."""
        ...


AgentRuntimeFactory = Callable[[Sequence[Callable[..., Any]], str], AgentRuntimePort]


@dataclass(frozen=True)
class AgentAnswer:
    """Represent one agent answer and whether it is grounded in available data."""

    status: str
    message: str


class FinancialAgentService:
    """Answer questions with read-only tools and report uncertainty on failure."""

    def __init__(
        self,
        registry: ToolRegistry,
        runtime_factory: AgentRuntimeFactory,
    ) -> None:
        """Store the tool allowlist and the runtime factory."""
        self._registry = registry
        self._runtime_factory = runtime_factory

    def ask(self, question: str) -> AgentAnswer:
        """Answer one question, or report uncertainty instead of inventing data.

        Args:
            question: Natural-language question from the user.

        Returns:
            An answer grounded in the allowlisted tools, or an unavailable answer
            when the runtime or its provider could not produce one.
        """
        try:
            runtime = self._runtime_factory(
                self._registry.callables(), READ_ONLY_SYSTEM_PROMPT
            )
            message = runtime.run(question)
        except Exception:
            return AgentAnswer(
                status=ANSWER_STATUS_UNAVAILABLE, message=UNAVAILABLE_MESSAGE
            )
        return AgentAnswer(status=ANSWER_STATUS_ANSWERED, message=message)


def build_agent_service(
    portfolio: PortfolioUseCases,
    analytics: PortfolioAnalyticsUseCases,
    *,
    environment: Mapping[str, str] | None = None,
    runtime_factory: AgentRuntimeFactory | None = None,
) -> FinancialAgentService:
    """Build the agent service from the application's read-only use cases.

    Args:
        portfolio: Read-only portfolio use cases.
        analytics: Read-only valuation and market analysis use cases.
        environment: Configuration source. Defaults to the process environment.
        runtime_factory: Runtime seam. Defaults to the Strands-backed runtime.

    Returns:
        A service exposing only the read-only tool allowlist.

    Raises:
        AgentConfigurationError: If the agent configuration is incomplete.
    """
    settings = AgentSettings.from_environment(environment)
    registry = build_tool_registry(FinancialReadTools(portfolio, analytics))
    factory = runtime_factory or _build_strands_factory(settings)
    return FinancialAgentService(registry, factory)


def _build_strands_factory(settings: AgentSettings) -> AgentRuntimeFactory:
    """Return a factory that builds the Strands runtime lazily."""

    def factory(
        tools: Sequence[Callable[..., Any]], system_prompt: str
    ) -> AgentRuntimePort:
        """Build the Strands runtime for the approved tools and policy."""
        return create_strands_runtime(tools, system_prompt, settings)

    return factory
