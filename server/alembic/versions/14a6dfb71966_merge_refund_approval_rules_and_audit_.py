"""merge refund approval rules and audit log fix heads

Revision ID: 14a6dfb71966
Revises: d5c5b9e2b4b1, w4x5y6z7a8b9
Create Date: 2026-07-14 10:52:23.415230

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14a6dfb71966'
down_revision: Union[str, Sequence[str], None] = ('d5c5b9e2b4b1', 'w4x5y6z7a8b9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
