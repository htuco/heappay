"""add transaction email preferences and notification log

Revision ID: o6p7q8r9s0t1
Revises: n5o6p7q8r9s0
Create Date: 2026-06-25

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o6p7q8r9s0t1"
down_revision: Union[str, Sequence[str], None] = "n5o6p7q8r9s0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "email_payment_sent_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "email_payment_received_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "email_topup_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "email_refund_status_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.create_table(
        "email_notification_log",
        sa.Column("email_notification_log_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("reference_id", sa.String(length=128), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("email_notification_log_id"),
        sa.UniqueConstraint(
            "user_id",
            "event_type",
            "reference_id",
            name="uq_email_notification_user_event_ref",
        ),
    )


def downgrade() -> None:
    op.drop_table("email_notification_log")
    op.drop_column("users", "email_refund_status_enabled")
    op.drop_column("users", "email_topup_enabled")
    op.drop_column("users", "email_payment_received_enabled")
    op.drop_column("users", "email_payment_sent_enabled")
