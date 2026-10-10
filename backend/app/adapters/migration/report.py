"""Immutable report models for the legacy SQLite dry-run validation.

These models describe the outcome of validating a :class:`SourceSnapshot`
without touching any destination: per-entity counts, rejected rows with a
reason, monetary rows whose currency could not be resolved, and an overall
readiness flag.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class RejectedRow:
    """A single source row rejected by a validation rule."""

    entity: str
    identifier: str
    reason: str


@dataclass(frozen=True)
class UnresolvedCurrencyRow:
    """A monetary source row whose ticker has no explicit currency mapping."""

    entity: str
    ticker: str
    reason: str


@dataclass(frozen=True)
class ValidationReport:
    """Dry-run validation summary produced before any destination write.

    ``ready`` is True only when there are zero rejected rows and zero
    unresolved-currency rows.
    """

    counts: Mapping[str, int]
    rejected: tuple[RejectedRow, ...] = ()
    unresolved_currency: tuple[UnresolvedCurrencyRow, ...] = ()

    @property
    def ready(self) -> bool:
        """Return True when no row was rejected and no currency is unresolved."""
        return not self.rejected and not self.unresolved_currency

    def rejected_for(self, entity: str) -> tuple[RejectedRow, ...]:
        """Return the rejected rows belonging to a single entity."""
        return tuple(row for row in self.rejected if row.entity == entity)

    def unresolved_for(self, entity: str) -> tuple[UnresolvedCurrencyRow, ...]:
        """Return the unresolved-currency rows belonging to a single entity."""
        return tuple(row for row in self.unresolved_currency if row.entity == entity)
