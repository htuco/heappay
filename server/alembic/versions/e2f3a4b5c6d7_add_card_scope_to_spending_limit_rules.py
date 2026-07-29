"""add card scope to spending limit rules

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6

Lets a SpendingLimitRule be scoped to a shared card instead of (or in addition
to) a single dependent: card_id set + dependent_user_id NULL is the
guardian's overall cap on the card; card_id + dependent_user_id both set is
one member's own cap on that card. dependent_user_id is relaxed to nullable
to allow the first case; a check constraint requires at least one of the two
to be set.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "spending_limit_rules",
        sa.Column("card_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_spending_limit_rules_card_id",
        "spending_limit_rules",
        "cards",
        ["card_id"],
        ["card_id"],
        ondelete="CASCADE",
    )
    op.alter_column("spending_limit_rules", "dependent_user_id", nullable=True)
    op.create_check_constraint(
        "ck_spending_limit_rules_scope_required",
        "spending_limit_rules",
        "dependent_user_id IS NOT NULL OR card_id IS NOT NULL",
    )
    op.create_index(
        "ix_spending_limit_rules_card_lookup",
        "spending_limit_rules",
        ["card_id", "dependent_user_id", "enabled"],
    )


def downgrade() -> None:
    op.drop_index("ix_spending_limit_rules_card_lookup", table_name="spending_limit_rules")
    op.drop_constraint(
        "ck_spending_limit_rules_scope_required", "spending_limit_rules", type_="check"
    )
    op.alter_column("spending_limit_rules", "dependent_user_id", nullable=False)
    op.drop_constraint("fk_spending_limit_rules_card_id", "spending_limit_rules", type_="foreignkey")
    op.drop_column("spending_limit_rules", "card_id")
