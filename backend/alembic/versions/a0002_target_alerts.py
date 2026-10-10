"""Add explicit target-alert intent and observation state."""

from alembic import op
import sqlalchemy as sa

revision = "a0002_target_alerts"
down_revision = "a0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add nullable intent/state columns without guessing legacy semantics."""
    op.add_column(
        "portfolio_positions", sa.Column("target_price", sa.Numeric(30, 10))
    )
    op.add_column(
        "portfolio_positions", sa.Column("alert_intent", sa.String(length=16))
    )
    op.add_column(
        "portfolio_positions",
        sa.Column("last_observed_price", sa.Numeric(30, 10)),
    )
    op.add_column(
        "wishlist_items", sa.Column("alert_intent", sa.String(length=16))
    )
    op.add_column(
        "wishlist_items", sa.Column("last_observed_price", sa.Numeric(30, 10))
    )


def downgrade() -> None:
    """Remove target-alert configuration and observation state."""
    op.drop_column("wishlist_items", "last_observed_price")
    op.drop_column("wishlist_items", "alert_intent")
    op.drop_column("portfolio_positions", "last_observed_price")
    op.drop_column("portfolio_positions", "alert_intent")
    op.drop_column("portfolio_positions", "target_price")
