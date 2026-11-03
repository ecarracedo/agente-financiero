"""Create ticker_aliases table for user-defined broker ticker mappings.

Stores mappings from broker tickers (e.g. DEL.RR.NAT.A) to official provider
names (e.g. Delta Recursos Naturales Clase A) so users can configure aliases
without code changes.
"""

from alembic import op
import sqlalchemy as sa

revision = "a0004_ticker_aliases"
down_revision = "a0003_migration_source_ids"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the ticker_aliases table."""
    op.create_table(
        "ticker_aliases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("broker_ticker", sa.String(32), nullable=False),
        sa.Column("official_name", sa.String(200), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False, server_default="ppi"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "uq_ticker_aliases_broker_ticker", "ticker_aliases", ["broker_ticker"], unique=True
    )


def downgrade() -> None:
    """Drop the ticker_aliases table."""
    op.drop_index("uq_ticker_aliases_broker_ticker", table_name="ticker_aliases")
    op.drop_table("ticker_aliases")
