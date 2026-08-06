"""add transaction initiated_by_user_id

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7

For most transactions the sender card's owner and the initiator are the same
person, but a shared family card is owned by the guardian and can be spent
from by an authorized dependent member -- this column is the only reliable
answer to "whose spend was this" in that case, needed for per-member spend
caps and so a dependent can see their own shared-card transaction history.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("initiated_by_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_transactions_initiated_by_user_id",
        "transactions",
        "users",
        ["initiated_by_user_id"],
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_transactions_initiated_by_user_id", "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "initiated_by_user_id")
