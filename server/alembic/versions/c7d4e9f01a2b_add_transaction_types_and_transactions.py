"""add transaction_types and transactions tables

Revision ID: c7d4e9f01a2b
Revises: b3e1f2a04c8d
Create Date: 2026-05-07 15:45:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c7d4e9f01a2b"
down_revision: Union[str, Sequence[str], None] = "b3e1f2a04c8d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "transaction_types",
        sa.Column("transaction_type_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("transaction_type_id"),
        sa.UniqueConstraint("name"),
    )

    op.execute(
        """
        INSERT INTO transaction_types (name)
        VALUES
            ('deposit'),
            ('payment'),
            ('refund'),
            ('withdrawal'),
            ('chargeback')
        ON CONFLICT (name) DO NOTHING
        """
    )

    op.create_table(
        "transactions",
        sa.Column("transaction_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sender_card_id", sa.Integer(), nullable=True),
        sa.Column("recipient_card_id", sa.Integer(), nullable=False),
        sa.Column("transaction_type_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
        sa.ForeignKeyConstraint(["sender_card_id"], ["cards.card_id"]),
        sa.ForeignKeyConstraint(["recipient_card_id"], ["cards.card_id"]),
        sa.ForeignKeyConstraint(
            ["transaction_type_id"], ["transaction_types.transaction_type_id"]
        ),
        sa.PrimaryKeyConstraint("transaction_id"),
    )

    op.create_index(
        "idx_transactions_sender_created",
        "transactions",
        ["sender_card_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_transactions_recipient_created",
        "transactions",
        ["recipient_card_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_transactions_recipient_created", table_name="transactions")
    op.drop_index("idx_transactions_sender_created", table_name="transactions")
    op.drop_table("transactions")
    op.drop_table("transaction_types")
