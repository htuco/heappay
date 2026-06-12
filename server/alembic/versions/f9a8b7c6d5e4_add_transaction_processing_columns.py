"""add transaction processing columns

Revision ID: f9a8b7c6d5e4
Revises: e3f4a5b6c7d8
Create Date: 2026-06-09 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f9a8b7c6d5e4"
down_revision: Union[str, Sequence[str], None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("processing_eligible_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("processed_by", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("deny_reason_code", sa.String(length=50), nullable=True),
    )

    # Existing rows: immediately eligible; already-final txs keep their created_at.
    op.execute(
        """
        UPDATE transactions
        SET processing_eligible_at = created_at
        WHERE processing_eligible_at IS NULL
        """
    )

    op.alter_column("transactions", "processing_eligible_at", nullable=False)


def downgrade() -> None:
    op.drop_column("transactions", "deny_reason_code")
    op.drop_column("transactions", "processed_by")
    op.drop_column("transactions", "processed_at")
    op.drop_column("transactions", "processing_eligible_at")
