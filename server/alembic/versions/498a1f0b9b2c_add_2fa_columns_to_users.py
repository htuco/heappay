"""add_2fa_columns_to_users

Revision ID: 498a1f0b9b2c
Revises: 67db23ad4b87
Create Date: 2026-06-15 10:56:58.096927

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '498a1f0b9b2c'
down_revision: Union[str, Sequence[str], None] = '67db23ad4b87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('totp_secret', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('totp_enabled', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'totp_enabled')
    op.drop_column('users', 'totp_secret')
