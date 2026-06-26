"""add category rules

Revision ID: a5f1c2d3e4b6
Revises: 94e8a14f84d7
Create Date: 2026-06-25 14:35:00.000000

Phase 2 of payment categorisation: a deterministic keyword-rule layer that
auto-categorises a transaction on create when the user did not pick a category.
Seeds a handful of global (user_id NULL) defaults. No ML/MCC — substring match
on the note / recipient name.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a5f1c2d3e4b6"
down_revision: Union[str, Sequence[str], None] = "94e8a14f84d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Global default rules: (keyword, match_field, category machine-name, priority).
# Keywords are matched as lowercased substrings. Lower priority wins.
DEFAULT_RULES = [
    ("netflix", "note", "subscriptions", 10),
    ("spotify", "note", "subscriptions", 10),
    ("youtube", "note", "subscriptions", 10),
    ("uber", "note", "transport", 10),
    ("lyft", "note", "transport", 10),
    ("taxi", "note", "transport", 10),
    ("bolt", "note", "transport", 20),
    ("grocery", "note", "groceries", 10),
    ("market", "note", "groceries", 20),
    ("supermarket", "note", "groceries", 10),
    ("restaurant", "note", "food_dining", 10),
    ("cafe", "note", "food_dining", 10),
    ("coffee", "note", "food_dining", 10),
    ("rent", "note", "housing", 10),
    ("electric", "note", "utilities", 10),
    ("water bill", "note", "utilities", 10),
    ("internet", "note", "utilities", 20),
    ("pharmacy", "note", "health", 10),
    ("salary", "note", "income", 10),
    ("payroll", "note", "income", 10),
]


def upgrade() -> None:
    op.create_table(
        "category_rules",
        sa.Column("rule_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("match_field", sa.String(length=20), nullable=False),
        sa.Column("keyword", sa.String(length=100), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("priority", sa.Integer(), server_default="100", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.user_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["transaction_categories.transaction_category_id"]
        ),
        sa.PrimaryKeyConstraint("rule_id"),
    )
    # Lookup index for the apply-on-create read path (global + per-user rules).
    op.create_index(
        "ix_category_rules_lookup", "category_rules", ["user_id", "priority"]
    )

    # Seed global defaults. Resolve category_id by machine-name so it stays
    # correct regardless of the seeded ids in transaction_categories.
    for keyword, match_field, category_name, priority in DEFAULT_RULES:
        op.execute(
            sa.text(
                """
                INSERT INTO category_rules (user_id, match_field, keyword, category_id, priority)
                SELECT NULL, :match_field, :keyword, tc.transaction_category_id, :priority
                FROM transaction_categories tc
                WHERE tc.name = :category_name
                """
            ).bindparams(
                match_field=match_field,
                keyword=keyword,
                category_name=category_name,
                priority=priority,
            )
        )


def downgrade() -> None:
    op.drop_index("ix_category_rules_lookup", table_name="category_rules")
    op.drop_table("category_rules")
