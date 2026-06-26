"""allow account biometric challenges

Revision ID: n5o6p7q8r9s0
Revises: m4n5o6p7q8r9
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n5o6p7q8r9s0"
down_revision: Union[str, Sequence[str], None] = "m4n5o6p7q8r9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "biometric_authentication_challenges",
        "transaction_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "biometric_authentication_challenges",
        "transaction_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
