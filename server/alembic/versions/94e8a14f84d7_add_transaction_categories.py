"""add transaction categories

Revision ID: 94e8a14f84d7
Revises: j2k3l4m5n6o7
Create Date: 2026-06-25 13:45:17.851556

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '94e8a14f84d7'
down_revision: Union[str, Sequence[str], None] = 'j2k3l4m5n6o7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Flat, wallet-relevant taxonomy derived from Monzo/Mint/YNAB defaults.
# Stored as snake_case machine names; the client maps to label + icon + color.
CATEGORY_NAMES = [
    "groceries",
    "food_dining",
    "transport",
    "utilities",
    "housing",
    "shopping",
    "entertainment",
    "health",
    "subscriptions",
    "transfer",
    "income",
    "fees",
    "other",
]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "transaction_categories",
        sa.Column(
            "transaction_category_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("transaction_category_id"),
        sa.UniqueConstraint("name"),
    )

    # Nullable FK: null = "Uncategorised". No backfill — existing transactions
    # stay null on purpose; category is optional metadata, not mandatory like status.
    op.add_column(
        "transactions", sa.Column("category_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "transactions_category_id_fkey",
        "transactions",
        "transaction_categories",
        ["category_id"],
        ["transaction_category_id"],
    )

    values = ", ".join(f"('{name}')" for name in CATEGORY_NAMES)
    op.execute(
        f"""
        INSERT INTO transaction_categories (name)
        VALUES {values}
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "transactions_category_id_fkey", "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "category_id")
    op.drop_table("transaction_categories")
