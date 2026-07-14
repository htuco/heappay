"""add audit log events

Revision ID: v3w4x5y6z7a8
Revises: u2v3w4x5y6z7
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "v3w4x5y6z7a8"
down_revision: Union[str, Sequence[str], None] = "u2v3w4x5y6z7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This revision previously shipped as t1u2v3w4x5y6, an ID it accidentally
    # shared with add_wallet_balance_to_users. Databases migrated from the
    # audit-log feature branch already have this table under the old ID.
    if sa.inspect(op.get_bind()).has_table("audit_log_events"):
        return
    op.create_table(
        "audit_log_events",
        sa.Column("event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column("resource_type", sa.String(length=40), nullable=True),
        sa.Column("resource_id", sa.String(length=64), nullable=True),
        sa.Column("detail", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("event_id"),
    )
    op.create_index("ix_audit_log_events_created_at", "audit_log_events", ["created_at"])
    op.create_index("ix_audit_log_events_event_type", "audit_log_events", ["event_type"])
    op.create_index("ix_audit_log_events_actor_user_id", "audit_log_events", ["actor_user_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_events_actor_user_id", table_name="audit_log_events")
    op.drop_index("ix_audit_log_events_event_type", table_name="audit_log_events")
    op.drop_index("ix_audit_log_events_created_at", table_name="audit_log_events")
    op.drop_table("audit_log_events")
