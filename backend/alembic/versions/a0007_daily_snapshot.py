"""Create portfolio_daily_snapshots and app_settings tables.

portfolio_daily_snapshots stores one row per day with the portfolio total
value, used by the accumulated performance chart. app_settings holds
key/value configuration such as the snapshot hour and timezone.
"""

from alembic import op
import sqlalchemy as sa


revision = "a0007_daily_snapshot"
down_revision = "a0006_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create snapshot and settings tables."""
    op.create_table(
        "portfolio_daily_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_value", sa.Numeric(30, 10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "uq_daily_snapshot_date",
        "portfolio_daily_snapshots",
        ["date"],
        unique=True,
    )
    op.create_index(
        op.f("ix_portfolio_daily_snapshots_date"),
        "portfolio_daily_snapshots",
        ["date"],
        unique=False,
    )

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("uq_app_setting_key", "app_settings", ["key"], unique=True)


def downgrade() -> None:
    """Drop snapshot and settings tables."""
    op.drop_index(op.f("ix_portfolio_daily_snapshots_date"), table_name="portfolio_daily_snapshots")
    op.drop_index("uq_daily_snapshot_date", table_name="portfolio_daily_snapshots")
    op.drop_table("portfolio_daily_snapshots")
    op.drop_index("uq_app_setting_key", table_name="app_settings")
    op.drop_table("app_settings")
