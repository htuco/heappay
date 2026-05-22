"""add is_main to cards

Revision ID: b1c2d3e4f5a6
Revises: 9a8b7c6d5e4f
Create Date: 2026-05-18 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "9a8b7c6d5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cards",
        sa.Column(
            "is_main",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # At most one main card per active user, enforced at the DB level.
    op.create_index(
        "unique_main_card_per_user",
        "cards",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_main = true AND deleted_at IS NULL"),
    )

    # Backfill: oldest active card per user becomes the main card.
    op.execute(
        """
        UPDATE cards
        SET is_main = true
        WHERE card_id IN (
            SELECT DISTINCT ON (user_id) card_id
            FROM cards
            WHERE deleted_at IS NULL
            ORDER BY user_id, created_at ASC, card_id ASC
        )
        """
    )


def downgrade() -> None:
    op.drop_index("unique_main_card_per_user", table_name="cards")
    op.drop_column("cards", "is_main")
