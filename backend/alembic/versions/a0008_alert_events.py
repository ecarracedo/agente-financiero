"""Persist one alert trigger event row per crossing."""

from alembic import op
import sqlalchemy as sa


revision = "a0008_alert_events"
down_revision = "a0007_daily_snapshot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create alert_event_records with indexes for the event listing."""
    op.create_table(
        "alert_event_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scope", sa.String(16), nullable=False),
        sa.Column("ticker", sa.String(32), nullable=False),
        sa.Column("target_price", sa.Numeric(30, 10), nullable=False),
        sa.Column("intent", sa.String(16), nullable=False),
        sa.Column("observed_price", sa.Numeric(30, 10), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("broker", sa.String(120)),
        sa.Column("category", sa.String(80)),
        sa.Column("currency", sa.String(3)),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_alert_event_records_triggered_at",
                    "alert_event_records", ["triggered_at"])


def downgrade() -> None:
    """Drop alert_event_records and its index."""
    op.drop_index("ix_alert_event_records_triggered_at", table_name="alert_event_records")
    op.drop_table("alert_event_records")
