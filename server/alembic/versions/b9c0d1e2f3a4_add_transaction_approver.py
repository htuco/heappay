"""add transaction approver

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3

Who is authorized to approve a pending transaction. Defaults to the payer;
redirected to a guardian when the payer is a dependent under a spending-limit
rule that requires approval. Nullable so existing rows need no backfill --
they fall back to the original sender-owner check.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, Sequence[str], None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("approver_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_transactions_approver_user_id",
        "transactions",
        "users",
        ["approver_user_id"],
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_transactions_approver_user_id", "transactions", type_="foreignkey")
    op.drop_column("transactions", "approver_user_id")
