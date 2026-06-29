"""add app pin to users

Revision ID: o6p7q8r9s0t1
Revises: n5o6p7q8r9s0
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o6p7q8r9s0t1"
down_revision: Union[str, Sequence[str], None] = "n5o6p7q8r9s0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("app_pin_hash", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "app_pin_failed_attempts",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("app_pin_locked_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("app_pin_set_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "app_pin_set_at")
    op.drop_column("users", "app_pin_locked_until")
    op.drop_column("users", "app_pin_failed_attempts")
    op.drop_column("users", "app_pin_hash")
