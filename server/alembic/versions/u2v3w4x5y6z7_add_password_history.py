"""add password history

Revision ID: u2v3w4x5y6z7
Revises: t1u2v3w4x5y6
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "u2v3w4x5y6z7"
down_revision: Union[str, Sequence[str], None] = "t1u2v3w4x5y6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "password_history",
        sa.Column("history_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("history_id"),
    )
    op.create_index("ix_password_history_user_id", "password_history", ["user_id"])
    op.create_index(
        "ix_password_history_user_id_created_at",
        "password_history",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_password_history_user_id_created_at", table_name="password_history")
    op.drop_index("ix_password_history_user_id", table_name="password_history")
    op.drop_table("password_history")
