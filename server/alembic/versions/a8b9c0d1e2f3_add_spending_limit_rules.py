"""add spending limit rules

Revision ID: a8b9c0d1e2f3
Revises: z7a8b9c0d1e2

Guardian-configured per-dependent spending caps, shaped like `category_rules`
but for amount caps instead of keyword matching. Multiple rules can apply to
the same transaction at once (an overall cap and a category cap both bind
independently), unlike `category_rules`' first-match resolver.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, Sequence[str], None] = "z7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "spending_limit_rules",
        sa.Column("spending_limit_rule_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("dependent_user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("period", sa.String(length=10), nullable=False),
        sa.Column("max_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("requires_approval_above", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column(
            "requires_approval_always", sa.Boolean(), server_default="false", nullable=False
        ),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["dependent_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["category_id"], ["transaction_categories.transaction_category_id"]
        ),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("spending_limit_rule_id"),
        sa.CheckConstraint(
            "period IN ('daily', 'weekly', 'monthly')",
            name="ck_spending_limit_rules_period_valid",
        ),
        sa.CheckConstraint("max_amount > 0", name="ck_spending_limit_rules_max_amount_positive"),
    )
    op.create_index(
        "ix_spending_limit_rules_lookup",
        "spending_limit_rules",
        ["dependent_user_id", "category_id", "enabled"],
    )


def downgrade() -> None:
    op.drop_index("ix_spending_limit_rules_lookup", table_name="spending_limit_rules")
    op.drop_table("spending_limit_rules")
