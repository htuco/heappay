"""add app pin to users

Revision ID: p7q8r9s0t1u2
Revises: o6p7q8r9s0t1
"""

from typing import Sequence, Union

from alembic import op

revision: str = "p7q8r9s0t1u2"
down_revision: Union[str, Sequence[str], None] = "o6p7q8r9s0t1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS app_pin_hash VARCHAR(255)")
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
        "app_pin_failed_attempts INTEGER NOT NULL DEFAULT 0"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
        "app_pin_locked_until TIMESTAMP WITH TIME ZONE"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
        "app_pin_set_at TIMESTAMP WITH TIME ZONE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS app_pin_set_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS app_pin_locked_until")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS app_pin_failed_attempts")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS app_pin_hash")
