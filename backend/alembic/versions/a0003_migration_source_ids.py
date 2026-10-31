"""Add unique source identifiers for idempotent legacy imports.

Every destination table gains a nullable ``source_id`` column holding the
legacy row id plus a unique index over it. Native (non-migrated) rows keep
``source_id`` NULL; SQLite and PostgreSQL both allow multiple NULLs in a unique
index, so native data can never collide with imported rows.
"""

from alembic import op
import sqlalchemy as sa

revision = "a0003_migration_source_ids"
down_revision = "a0002_target_alerts"
branch_labels = None
depends_on = None

_TABLES = (
    "portfolio_positions",
    "portfolio_transactions",
    "wishlist_items",
    "bibliography_items",
)


def _index_name(table: str) -> str:
    """Return the unique source-id index name for a destination table."""
    return f"uq_{table}_source_id"


def upgrade() -> None:
    """Add nullable unique source-id columns to every destination table."""
    for table in _TABLES:
        op.add_column(table, sa.Column("source_id", sa.Integer(), nullable=True))
        op.create_index(_index_name(table), table, ["source_id"], unique=True)


def downgrade() -> None:
    """Remove the source-id columns and their unique indexes."""
    for table in reversed(_TABLES):
        op.drop_index(_index_name(table), table_name=table)
        op.drop_column(table, "source_id")