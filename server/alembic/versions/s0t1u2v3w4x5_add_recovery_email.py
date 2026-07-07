"""add recovery email and security audit events

Revision ID: s0t1u2v3w4x5
Revises: r9s0t1u2v3w4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s0t1u2v3w4x5"
down_revision: Union[str, Sequence[str], None] = "r9s0t1u2v3w4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("recovery_email", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column("recovery_email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("recovery_email_verification_token", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "recovery_email_verification_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index(
        "uq_users_recovery_email",
        "users",
        ["recovery_email"],
        unique=True,
        postgresql_where=sa.text("recovery_email IS NOT NULL"),
    )

    op.create_table(
        "user_security_audit_events",
        sa.Column("event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("detail", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("event_id"),
    )
    op.create_index(
        "ix_user_security_audit_events_user_id",
        "user_security_audit_events",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_security_audit_events_user_id", table_name="user_security_audit_events")
    op.drop_table("user_security_audit_events")
    op.drop_index("uq_users_recovery_email", table_name="users")
    op.drop_column("users", "recovery_email_verification_expires_at")
    op.drop_column("users", "recovery_email_verification_token")
    op.drop_column("users", "recovery_email_verified_at")
    op.drop_column("users", "recovery_email")
