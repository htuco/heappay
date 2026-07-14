"""add admin request notifications

Adds the per-admin opt-in flag (users.notify_on_user_requests) and the
admin_notification_log audit/dedup table for admin email notifications on
user-submitted requests.

Revision ID: x5y6z7a8b9c0
Revises: w4x5y6z7a8b9
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "x5y6z7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "w4x5y6z7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "notify_on_user_requests",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.create_table(
        "admin_notification_log",
        sa.Column(
            "admin_notification_log_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("recipient_user_id", sa.Integer(), nullable=False),
        sa.Column("recipient_email", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("reference_id", sa.String(length=128), nullable=False),
        sa.Column(
            "channel", sa.String(length=16), server_default="email", nullable=False
        ),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["recipient_user_id"], ["users.user_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("admin_notification_log_id"),
        sa.UniqueConstraint(
            "recipient_user_id",
            "event_type",
            "reference_id",
            name="uq_admin_notification_recipient_event_ref",
        ),
    )
    op.create_index(
        "ix_admin_notification_log_recipient_user_id",
        "admin_notification_log",
        ["recipient_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_admin_notification_log_recipient_user_id",
        table_name="admin_notification_log",
    )
    op.drop_table("admin_notification_log")
    op.drop_column("users", "notify_on_user_requests")
