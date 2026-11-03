"""Seed the broker ticker aliases observed in this portfolio.

The PPI provider no longer ships a hardcoded alias list, so the two symbols this
portfolio already used are inserted as ordinary rows. Seeding is idempotent: a
symbol that already has an alias is left untouched, and users can edit or delete
every row from the Settings screen.
"""

from alembic import op
import sqlalchemy as sa

revision = "a0005_ticker_alias_seed"
down_revision = "a0004_ticker_aliases"
branch_labels = None
depends_on = None

_SEED_ALIASES = (
    ("AL.DIVER.A", "Allaria Diversificado Clase A"),
    ("DEL.RR.NAT.A", "Delta Recursos Naturales Clase A"),
)


def upgrade() -> None:
    """Insert the seed aliases that are not already present."""
    bind = op.get_bind()
    for broker_ticker, official_name in _SEED_ALIASES:
        exists = bind.execute(
            sa.text("SELECT 1 FROM ticker_aliases WHERE broker_ticker = :ticker"),
            {"ticker": broker_ticker},
        ).first()
        if exists is None:
            bind.execute(
                sa.text(
                    "INSERT INTO ticker_aliases "
                    "(broker_ticker, official_name, provider, created_at) "
                    "VALUES (:ticker, :name, 'ppi', CURRENT_TIMESTAMP)"
                ),
                {"ticker": broker_ticker, "name": official_name},
            )


def downgrade() -> None:
    """Remove the seed aliases."""
    bind = op.get_bind()
    for broker_ticker, _official_name in _SEED_ALIASES:
        bind.execute(
            sa.text("DELETE FROM ticker_aliases WHERE broker_ticker = :ticker"),
            {"ticker": broker_ticker},
        )
