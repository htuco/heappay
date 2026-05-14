"""add cardholder_name to cards

Revision ID: e2f5c4a7b9d1
Revises: f1a2b3c4d5e6
Create Date: 2026-05-14 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2f5c4a7b9d1"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cards",
        sa.Column("cardholder_name", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cards", "cardholder_name")
