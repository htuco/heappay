"""add transaction_statuses and status_id to transactions

Revision ID: d8f3c1b05e9a
Revises: c7d4e9f01a2b
Create Date: 2026-05-07 16:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d8f3c1b05e9a"
down_revision: Union[str, Sequence[str], None] = "c7d4e9f01a2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "transaction_statuses",
        sa.Column("transaction_status_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("transaction_status_id"),
        sa.UniqueConstraint("name"),
    )

    op.execute(
        """
        INSERT INTO transaction_statuses (name)
        VALUES
            ('pending'),
            ('completed'),
            ('failed'),
            ('reversed')
        ON CONFLICT (name) DO NOTHING
        """
    )

    # Add as nullable first so existing rows are not rejected before we backfill
    op.add_column(
        "transactions",
        sa.Column(
            "status_id",
            sa.Integer(),
            sa.ForeignKey("transaction_statuses.transaction_status_id"),
            nullable=True,
        ),
    )

    # Backfill all existing rows to 'completed'
    op.execute(
        """
        UPDATE transactions
        SET status_id = (
            SELECT transaction_status_id
            FROM transaction_statuses
            WHERE name = 'completed'
        )
        """
    )

    # Now enforce NOT NULL
    op.alter_column("transactions", "status_id", nullable=False)


def downgrade() -> None:
    op.drop_column("transactions", "status_id")
    op.drop_table("transaction_statuses")
