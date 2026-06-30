"""add payment confirmation preferences to users

Revision ID: r9s0t1u2v3w4
Revises: q8r9s0t1u2v3
"""

from typing import Sequence, Union

from alembic import op

revision: str = "r9s0t1u2v3w4"
down_revision: Union[str, Sequence[str], None] = "q8r9s0t1u2v3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
        "payment_confirm_enabled BOOLEAN NOT NULL DEFAULT true"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
        "payment_confirm_above_amount NUMERIC(12, 2) NOT NULL DEFAULT 0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS payment_confirm_above_amount")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS payment_confirm_enabled")
