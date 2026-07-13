"""add refund_approval_rules table

Revision ID: d5c5b9e2b4b1
Revises: u2v3w4x5y6z7

Adds the singleton refund_approval_rules row that the refund processor reads
and the admin UI edits. Seeded disabled so behavior is unchanged until an
admin opts in.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d5c5b9e2b4b1"
down_revision: Union[str, Sequence[str], None] = "u2v3w4x5y6z7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "refund_approval_rules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("auto_approve_max_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("max_age_days", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.user_id"),
            nullable=True,
        ),
    )
    op.execute(
        sa.text(
            "INSERT INTO refund_approval_rules (enabled, auto_approve_max_amount, max_age_days) "
            "VALUES (false, 25.00, 7)"
        )
    )


def downgrade() -> None:
    op.drop_table("refund_approval_rules")
