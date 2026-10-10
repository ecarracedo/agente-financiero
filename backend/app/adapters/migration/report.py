"""Immutable report models for the legacy SQLite dry-run validation.

These models describe the outcome of validating a :class:`SourceSnapshot`
without touching any destination: per-entity counts, rejected rows with a
reason, monetary rows whose currency could not be resolved, and an overall
readiness flag.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
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


@dataclass(frozen=True)
class EntityImportResult:
    """Per-entity outcome counters for one import run.

    ``rejected`` counts rows the run refused to import because validation was
    not ready for that entity; ``inserted``, ``updated``, and ``skipped`` count
    the idempotent write decisions taken by ``source_id``.
    """

    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    rejected: int = 0


@dataclass(frozen=True)
class ImportResult:
    """Outcome of one transactional import across every destination entity.

    ``committed`` is True only when the single destination transaction was
    committed. When the validation report is not ready, nothing is written and
    ``committed`` stays False.
    """

    portfolio_items: EntityImportResult
    transactions: EntityImportResult
    wishlist_items: EntityImportResult
    bibliography_items: EntityImportResult
    committed: bool = True

    @property
    def inserted_total(self) -> int:
        """Return the total number of inserted rows across all entities."""
        return (
            self.portfolio_items.inserted
            + self.transactions.inserted
            + self.wishlist_items.inserted
            + self.bibliography_items.inserted
        )

    @property
    def updated_total(self) -> int:
        """Return the total number of updated rows across all entities."""
        return (
            self.portfolio_items.updated
            + self.transactions.updated
            + self.wishlist_items.updated
            + self.bibliography_items.updated
        )

    @property
    def skipped_total(self) -> int:
        """Return the total number of skipped duplicate rows across all entities."""
        return (
            self.portfolio_items.skipped
            + self.transactions.skipped
            + self.wishlist_items.skipped
            + self.bibliography_items.skipped
        )


@dataclass(frozen=True)
class EntityReconciliation:
    """Per-entity source-versus-destination count and balance comparison."""

    entity: str
    source_count: int
    destination_count: int
    source_balances: Mapping[str, Decimal] = field(default_factory=dict)
    destination_balances: Mapping[str, Decimal] = field(default_factory=dict)

    @property
    def matched(self) -> bool:
        """Return True when both row counts and monetary balances agree."""
        return self.source_count == self.destination_count and dict(
            self.source_balances
        ) == dict(self.destination_balances)


@dataclass(frozen=True)
class ReconciliationReport:
    """Reconciliation of every entity after an import."""

    entities: Mapping[str, EntityReconciliation]

    @property
    def matched(self) -> bool:
        """Return True when every reconciled entity matches its source."""
        return all(entity.matched for entity in self.entities.values())
