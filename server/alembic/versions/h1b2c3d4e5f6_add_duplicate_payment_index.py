"""add index for duplicate payment detection

Revision ID: h1b2c3d4e5f6
Revises: g3a1b2c3d4e5
"""

from typing import Sequence, Union

from alembic import op

revision: str = "h1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "g3a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_transactions_duplicate_lookup",
        "transactions",
        ["sender_card_id", "recipient_card_id", "amount", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_duplicate_lookup", table_name="transactions")
