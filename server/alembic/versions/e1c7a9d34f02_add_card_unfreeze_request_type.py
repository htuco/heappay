"""add card_unfreeze request type

Users can ask staff to unfreeze a previously frozen card. This reuses the
``card_freeze_request_details`` table (it only links a request to a card), so
this migration just seeds the new request type.

Revision ID: e1c7a9d34f02
Revises: d9b2f4e10c83
Create Date: 2026-06-17 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "e1c7a9d34f02"
down_revision: Union[str, Sequence[str], None] = "d9b2f4e10c83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO request_types (name) VALUES
            ('card_unfreeze')
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM request_types WHERE name = 'card_unfreeze'")
