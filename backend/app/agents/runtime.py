"""Strands-backed runtime for the read-only agent, loaded lazily.

The Strands import happens inside the factory rather than at module scope, so
this package imports and its tools run even when the heavy dependency is absent.
"""

import importlib
from collections.abc import Callable, Sequence
from typing import Any

from backend.app.agents.config import AgentSettings


class StrandsUnavailableError(RuntimeError):
    """Report that Strands or its Bedrock model could not be loaded."""


class StrandsRuntime:
    """Run prompts through a configured Strands agent."""

    def __init__(self, agent: Any) -> None:
        """Store the configured Strands agent."""
        self._agent = agent

    def run(self, prompt: str) -> str:
        """Return the agent's answer text for one prompt."""
        return str(self._agent(prompt))


def _load_strands() -> tuple[Any, Any, Any]:
    """Import the Strands entry points lazily, as the market adapter does.

    Returns:
        The Agent class, the tool decorator and the Bedrock model class.

    Raises:
        StrandsUnavailableError: If the Strands dependency is not installed.
    """
    try:
        strands_module = importlib.import_module("strands")
        models_module = importlib.import_module("strands.models")
    except ImportError as error:
        raise StrandsUnavailableError(
            "the strands-agents dependency is not installed"
        ) from error
    return (
        getattr(strands_module, "Agent"),
        getattr(strands_module, "tool"),
        getattr(models_module, "BedrockModel"),
    )


def create_strands_runtime(
    tools: Sequence[Callable[..., Any]],
    system_prompt: str,
    settings: AgentSettings,
) -> StrandsRuntime:
    """Build a Strands runtime over the approved read-only tools.

    Args:
        tools: The allowlisted tool callables handed to the agent.
        system_prompt: The read-only policy the agent must follow.
        settings: Model identifier and AWS region resolved from the environment.

    Returns:
        A runtime bound to a Bedrock-backed Strands agent.

    Raises:
        StrandsUnavailableError: If the Strands dependency is not installed.
    """
    agent_class, tool_decorator, bedrock_model_class = _load_strands()
    model = bedrock_model_class(model_id=settings.model_id, region_name=settings.region)
    return StrandsRuntime(
        agent_class(
            model=model,
            tools=[tool_decorator(callable_) for callable_ in tools],
            system_prompt=system_prompt,
        )
    )
