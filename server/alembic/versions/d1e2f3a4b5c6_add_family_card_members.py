"""add family card members

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6

Authorizes a dependent to spend from a card they don't own (a "shared family
card"). The card keeps its single owner (the guardian); membership is what
makes it shared.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "family_card_members",
        sa.Column("family_card_member_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("card_id", sa.Integer(), nullable=False),
        sa.Column("dependent_user_id", sa.Integer(), nullable=False),
        sa.Column("added_by_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["card_id"], ["cards.card_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dependent_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["added_by_user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("family_card_member_id"),
        sa.UniqueConstraint(
            "card_id", "dependent_user_id", name="uq_family_card_members_card_dependent"
        ),
    )
    op.create_index("ix_family_card_members_card_id", "family_card_members", ["card_id"])
    op.create_index(
        "ix_family_card_members_dependent_user_id", "family_card_members", ["dependent_user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_family_card_members_dependent_user_id", table_name="family_card_members")
    op.drop_index("ix_family_card_members_card_id", table_name="family_card_members")
    op.drop_table("family_card_members")
