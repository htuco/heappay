"""add recurring payments

Revision ID: i1j2k3l4m5n6
Revises: h1b2c3d4e5f6
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i1j2k3l4m5n6"
down_revision: Union[str, Sequence[str], None] = "h1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recurring_payments",
        sa.Column("recurring_payment_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_card_id", sa.Integer(), sa.ForeignKey("cards.card_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("recipient_card_id", sa.Integer(), sa.ForeignKey("cards.card_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("day_of_month", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("next_due_at", sa.Date(), nullable=False),
        sa.Column("last_run_failed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_run_error", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("day_of_month BETWEEN 1 AND 28", name="ck_recurring_payments_day_of_month"),
        sa.CheckConstraint("amount > 0", name="ck_recurring_payments_amount_positive"),
    )
    op.create_index("ix_recurring_payments_user_status", "recurring_payments", ["user_id", "status"])
    op.create_index("ix_recurring_payments_due", "recurring_payments", ["status", "next_due_at"])

    op.add_column(
        "transactions",
        sa.Column(
            "recurring_payment_id",
            sa.Integer(),
            sa.ForeignKey("recurring_payments.recurring_payment_id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("transactions", "recurring_payment_id")
    op.drop_index("ix_recurring_payments_due", table_name="recurring_payments")
    op.drop_index("ix_recurring_payments_user_status", table_name="recurring_payments")
    op.drop_table("recurring_payments")
