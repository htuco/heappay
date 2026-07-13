"""merge email verification and recovery email heads

Revision ID: e27872d74c90
Revises: 0492dd1e4753, s0t1u2v3w4x5
Create Date: 2026-07-01 15:01:22.182144

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e27872d74c90'
down_revision: Union[str, Sequence[str], None] = ('0492dd1e4753', 's0t1u2v3w4x5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
