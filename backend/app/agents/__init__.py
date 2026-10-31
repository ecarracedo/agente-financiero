"""Read-only financial agent built on an explicit analytical tool allowlist.

Importing this package never imports the heavy Strands dependency: the runtime
module loads it lazily inside its factory, so the tools stay testable on their own.
"""

from backend.app.agents.config import AgentConfigurationError, AgentSettings
from backend.app.agents.service import (
    ANSWER_STATUS_ANSWERED,
    ANSWER_STATUS_UNAVAILABLE,
    UNAVAILABLE_MESSAGE,
    AgentAnswer,
    build_agent_service,
)
from backend.app.agents.tools import (
    READ_ONLY_TOOL_NAMES,
    FinancialReadTools,
    ToolNotPermittedError,
    ToolRegistry,
    build_tool_registry,
)

__all__ = [
    "ANSWER_STATUS_ANSWERED",
    "ANSWER_STATUS_UNAVAILABLE",
    "READ_ONLY_TOOL_NAMES",
    "UNAVAILABLE_MESSAGE",
    "AgentAnswer",
    "AgentConfigurationError",
    "AgentSettings",
    "FinancialReadTools",
    "ToolNotPermittedError",
    "ToolRegistry",
    "build_agent_service",
    "build_tool_registry",
]
