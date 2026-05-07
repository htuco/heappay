"""add balance to cards

Revision ID: b3e1f2a04c8d
Revises: 4c2f9b8d1e7a
Create Date: 2026-05-07 15:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3e1f2a04c8d"
down_revision: Union[str, Sequence[str], None] = "4c2f9b8d1e7a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cards",
        sa.Column(
            "balance",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
            server_default="0.00",
        ),
    )


def downgrade() -> None:
    op.drop_column("cards", "balance")
