"""add email outflow preference

Revision ID: c1285d81b7df
Revises: x5y6z7a8b9c0
Create Date: 2026-07-14 16:10:31.136814

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c1285d81b7df'
down_revision: Union[str, Sequence[str], None] = 'x5y6z7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "email_outflow_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "email_outflow_enabled")
