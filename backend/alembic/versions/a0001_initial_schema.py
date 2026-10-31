"""Create the initial financial-agent schema."""

from alembic import op
import sqlalchemy as sa

revision = "a0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the initial portfolio and resource tables."""
    op.create_table(
        "portfolio_positions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticker", sa.String(length=32), nullable=False),
        sa.Column("broker", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("quantity", sa.Numeric(30, 10), nullable=False),
        sa.Column("average_price", sa.Numeric(30, 10), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.UniqueConstraint(
            "ticker", "broker", "category", name="uq_portfolio_position_identity"
        ),
    )
    op.create_index(
        "ix_portfolio_positions_ticker", "portfolio_positions", ["ticker"]
    )
    op.create_table(
        "portfolio_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticker", sa.String(length=32), nullable=False),
        sa.Column("broker", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("operation_type", sa.String(length=8), nullable=False),
        sa.Column("quantity", sa.Numeric(30, 10), nullable=False),
        sa.Column("unit_price", sa.Numeric(30, 10), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_portfolio_transactions_ticker", "portfolio_transactions", ["ticker"]
    )
    op.create_table(
        "wishlist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticker", sa.String(length=32), nullable=False, unique=True),
        sa.Column("target_price", sa.Numeric(30, 10)),
    )
    op.create_table(
        "bibliography_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("author", sa.String(length=200), nullable=False),
        sa.Column("year", sa.Integer()),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("link", sa.String(length=2000)),
        sa.Column("description", sa.Text()),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    """Drop the initial financial-agent tables."""
    op.drop_table("bibliography_items")
    op.drop_table("wishlist_items")
    op.drop_index(
        "ix_portfolio_transactions_ticker", table_name="portfolio_transactions"
    )
    op.drop_table("portfolio_transactions")
    op.drop_index("ix_portfolio_positions_ticker", table_name="portfolio_positions")
    op.drop_table("portfolio_positions")
