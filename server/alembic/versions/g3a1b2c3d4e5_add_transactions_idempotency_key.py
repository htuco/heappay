"""add idempotency_key to transactions

Revision ID: g3a1b2c3d4e5
Revises: e3f4a5b6c7d8
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g3a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
    )
    op.create_unique_constraint(
        "uq_transactions_idempotency_key",
        "transactions",
        ["idempotency_key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_transactions_idempotency_key", "transactions", type_="unique")
    op.drop_column("transactions", "idempotency_key")
