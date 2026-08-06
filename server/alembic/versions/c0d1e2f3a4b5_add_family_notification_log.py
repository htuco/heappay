"""add family notification log

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4

Audit + dedup ledger for guardian<->dependent family notifications. Same
shape as admin_notification_log, but user-scoped rather than staff-scoped.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, Sequence[str], None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "family_notification_log",
        sa.Column(
            "family_notification_log_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("recipient_user_id", sa.Integer(), nullable=False),
        sa.Column("recipient_email", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("reference_id", sa.String(length=128), nullable=False),
        sa.Column("channel", sa.String(length=16), server_default="email", nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("family_notification_log_id"),
        sa.UniqueConstraint(
            "recipient_user_id",
            "event_type",
            "reference_id",
            name="uq_family_notification_recipient_event_ref",
        ),
    )
    op.create_index(
        "ix_family_notification_log_recipient_user_id",
        "family_notification_log",
        ["recipient_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_family_notification_log_recipient_user_id",
        table_name="family_notification_log",
    )
    op.drop_table("family_notification_log")
