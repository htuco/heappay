"""add unique constraint to cards.card_numb

Revision ID: f1a2b3c4d5e6
Revises: d8f3c1b05e9a
Branch Labels: None
Depends On: None

"""

from typing import Sequence, Union

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = ("d8f3c1b05e9a", "4c2f9b8d1e7a")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint("uq_cards_card_numb", "cards", ["card_numb"])


def downgrade() -> None:
    op.drop_constraint("uq_cards_card_numb", "cards", type_="unique")
