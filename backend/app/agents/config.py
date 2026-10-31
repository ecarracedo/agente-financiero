"""Environment-driven configuration for the read-only financial agent."""

import os
from collections.abc import Mapping
from dataclasses import dataclass

AGENT_MODEL_ENVIRONMENT_VARIABLE = "AGENT_MODEL_ID"
AGENT_REGION_ENVIRONMENT_VARIABLE = "AWS_REGION"


class AgentConfigurationError(RuntimeError):
    """Report an incomplete or invalid agent environment configuration."""


@dataclass(frozen=True)
class AgentSettings:
    """Carry the model and region the agent runs with, and nothing secret."""

    model_id: str
    region: str

    @classmethod
    def from_environment(
        cls, environment: Mapping[str, str] | None = None
    ) -> "AgentSettings":
        """Build settings from the environment, rejecting missing or blank values.

        Args:
            environment: Mapping to read from. Defaults to the process environment.

        Returns:
            Settings holding the configured model identifier and AWS region.

        Raises:
            AgentConfigurationError: If a required variable is missing or blank.
        """
        source = os.environ if environment is None else environment
        values: dict[str, str] = {}
        for name in (
            AGENT_MODEL_ENVIRONMENT_VARIABLE,
            AGENT_REGION_ENVIRONMENT_VARIABLE,
        ):
            value = (source.get(name) or "").strip()
            if not value:
                raise AgentConfigurationError(f"{name} is required")
            values[name] = value
        return cls(
            model_id=values[AGENT_MODEL_ENVIRONMENT_VARIABLE],
            region=values[AGENT_REGION_ENVIRONMENT_VARIABLE],
        )
