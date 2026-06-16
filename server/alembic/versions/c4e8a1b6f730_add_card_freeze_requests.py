"""add card freeze requests

Adds the ``card_freeze`` request type (so users can ask staff to freeze a card,
e.g. when it is lost or stolen) and a ``card_freeze_request_details`` table that
links a request to the card it targets — mirroring ``refund_request_details``.
At most one *pending* freeze request per card is enforced in the service layer
(status ids are not stable across environments, so a partial unique index keyed
on a status id is avoided), allowing a new request after an earlier one resolves.

Revision ID: c4e8a1b6f730
Revises: b1f7a3d92c40
Create Date: 2026-06-16 09:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c4e8a1b6f730"
down_revision: Union[str, Sequence[str], None] = "b1f7a3d92c40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO request_types (name) VALUES
            ('card_freeze')
        ON CONFLICT (name) DO NOTHING
        """
    )

    op.create_table(
        "card_freeze_request_details",
        sa.Column("request_id", sa.Integer(), nullable=False),
        sa.Column("card_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["request_id"], ["requests.request_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["card_id"], ["cards.card_id"]),
        sa.PrimaryKeyConstraint("request_id"),
    )
    op.create_index(
        "idx_card_freeze_details_card", "card_freeze_request_details", ["card_id"]
    )


def downgrade() -> None:
    op.drop_index(
        "idx_card_freeze_details_card", table_name="card_freeze_request_details"
    )
    op.drop_table("card_freeze_request_details")
    op.execute("DELETE FROM request_types WHERE name = 'card_freeze'")
