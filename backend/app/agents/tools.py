"""Read-only tools the financial agent is allowed to call.

The allowlist below is the agent's entire capability. Only the four approved
reads exist, no write use case is imported, and no SQL text or database handle
is reachable from this module.
"""

from collections.abc import Callable
from decimal import Decimal
from typing import Any

from backend.app.application.analytics import PortfolioAnalyticsUseCases
from backend.app.application.portfolio import PortfolioUseCases

READ_ONLY_TOOL_NAMES: tuple[str, ...] = (
    "read_portfolio",
    "read_valuations",
    "read_market_analysis",
    "read_history",
)


class ToolNotPermittedError(PermissionError):
    """Report a request for a tool that is not on the read-only allowlist."""


def _decimal_text(value: Decimal | None) -> str | None:
    """Render a Decimal as text, so the payload keeps its exact precision."""
    return None if value is None else str(value)


class FinancialReadTools:
    """Expose the application's read-only portfolio and market queries."""

    def __init__(
        self,
        portfolio: PortfolioUseCases,
        analytics: PortfolioAnalyticsUseCases,
    ) -> None:
        """Store the read-only use cases every tool delegates to."""
        self._portfolio = portfolio
        self._analytics = analytics

    def read_portfolio(self) -> dict[str, Any]:
        """Return every position with its quantity, average price and currency."""
        return {
            "positions": [
                {
                    "ticker": position.ticker,
                    "broker": position.broker,
                    "category": position.category,
                    "quantity": _decimal_text(position.quantity),
                    "average_price": _decimal_text(position.average_price),
                    "currency": position.currency,
                }
                for position in self._portfolio.list_positions()
            ]
        }

    def read_valuations(self) -> dict[str, Any]:
        """Return per-currency valuation, keeping unpriced tickers explicit."""
        return {
            "valuations": [
                {
                    "currency": valuation.currency,
                    "invested_value": _decimal_text(valuation.invested_value),
                    "market_value": _decimal_text(valuation.market_value),
                    "gain_loss": _decimal_text(valuation.gain_loss),
                    "gain_loss_percent": _decimal_text(valuation.gain_loss_percent),
                    "unpriced_tickers": list(valuation.unpriced_tickers),
                }
                for valuation in self._analytics.value_portfolio().values()
            ]
        }

    def read_market_analysis(self, ticker: str, period: str = "1y") -> dict[str, Any]:
        """Return one ticker's analysis, reporting missing prices as absent."""
        analysis = self._analytics.analyze_ticker(ticker, period)
        return {
            "ticker": analysis.ticker,
            "status": analysis.status,
            "reason": analysis.reason,
            "current_price": _decimal_text(analysis.current_price),
            "high_52_week": _decimal_text(analysis.high_52_week),
            "low_52_week": _decimal_text(analysis.low_52_week),
            "moving_average_50": _decimal_text(analysis.moving_average_50),
            "moving_average_200": _decimal_text(analysis.moving_average_200),
            "signals": list(analysis.signals),
            "series": [
                {"date": point.date.isoformat(), "close": _decimal_text(point.close)}
                for point in analysis.series
            ],
        }

    def read_history(self, ticker: str, broker: str) -> dict[str, Any]:
        """Return the transaction history for one ticker and broker."""
        return {
            "history": [
                {
                    "id": transaction.id,
                    "ticker": transaction.ticker,
                    "broker": transaction.broker,
                    "category": transaction.category,
                    "operation_type": transaction.operation_type,
                    "quantity": _decimal_text(transaction.quantity),
                    "unit_price": _decimal_text(transaction.unit_price),
                    "currency": transaction.currency,
                    "occurred_at": transaction.occurred_at.isoformat(),
                }
                for transaction in self._portfolio.list_history(ticker, broker)
            ]
        }


class ToolRegistry:
    """Map the approved tool names to their bound read-only callables."""

    def __init__(self, tools: FinancialReadTools) -> None:
        """Bind exactly the allowlisted read methods of the given tools."""
        self._tools: dict[str, Callable[..., dict[str, Any]]] = {
            name: getattr(tools, name) for name in READ_ONLY_TOOL_NAMES
        }

    @property
    def names(self) -> tuple[str, ...]:
        """Return the allowlisted tool names in declaration order."""
        return READ_ONLY_TOOL_NAMES

    def callables(self) -> tuple[Callable[..., dict[str, Any]], ...]:
        """Return the bound allowlisted callables handed to the runtime."""
        return tuple(self._tools[name] for name in READ_ONLY_TOOL_NAMES)

    def invoke(self, name: str, /, **arguments: Any) -> dict[str, Any]:
        """Invoke one allowlisted tool and refuse every other name.

        Args:
            name: Tool name requested by the caller.
            arguments: Keyword arguments forwarded to the approved tool.

        Returns:
            The tool's JSON-ready payload.

        Raises:
            ToolNotPermittedError: If the name is not on the allowlist.
        """
        callable_ = self._tools.get(name)
        if callable_ is None:
            raise ToolNotPermittedError(f"tool {name!r} is not permitted")
        return callable_(**arguments)


def build_tool_registry(tools: FinancialReadTools) -> ToolRegistry:
    """Create the registry that exposes only the read-only allowlist."""
    return ToolRegistry(tools)
