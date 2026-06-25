"""add payment approval columns, audit events, and fine transaction type

Revision ID: h4a5b6c7d8e9
Revises: e1c7a9d34f02
Create Date: 2026-06-24 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h4a5b6c7d8e9"
down_revision: Union[str, Sequence[str], None] = "e1c7a9d34f02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column(
            "requires_user_approval",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
    )
    op.add_column(
        "transactions",
        sa.Column("user_approval_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("user_approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("user_approval_method", sa.String(length=20), nullable=True),
    )

    op.create_table(
        "payment_approval_events",
        sa.Column("event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("verification_method", sa.String(length=20), nullable=True),
        sa.Column("detail", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.transaction_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.user_id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("event_id"),
    )
    op.create_index(
        "ix_payment_approval_events_transaction_id",
        "payment_approval_events",
        ["transaction_id"],
    )

    op.execute(
        """
        INSERT INTO transaction_types (name)
        VALUES ('fine')
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_payment_approval_events_transaction_id",
        table_name="payment_approval_events",
    )
    op.drop_table("payment_approval_events")
    op.drop_column("transactions", "user_approval_method")
    op.drop_column("transactions", "user_approved_at")
    op.drop_column("transactions", "user_approval_expires_at")
    op.drop_column("transactions", "requires_user_approval")
    op.execute("DELETE FROM transaction_types WHERE name = 'fine'")
