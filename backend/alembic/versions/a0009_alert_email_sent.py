"""Track which alert crossings have already been emailed.

Revision ID: a0009_alert_email_sent
Revises: a0008_alert_events
"""

from alembic import op
import sqlalchemy as sa


revision = "a0009_alert_email_sent"
down_revision = "a0008_alert_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add emailed_at and treat all pre-existing crossings as already sent."""
    op.add_column(
        "alert_event_records",
        sa.Column("emailed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Historical rows predate email delivery; marking them avoids replaying the
    # whole event history as email on the first deployment of this migration.
    op.execute("UPDATE alert_event_records SET emailed_at = CURRENT_TIMESTAMP")


def downgrade() -> None:
    """Drop the emailed_at column."""
    op.drop_column("alert_event_records", "emailed_at")
