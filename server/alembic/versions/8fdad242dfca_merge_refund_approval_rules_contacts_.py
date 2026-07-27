"""merge refund approval rules, contacts, and email outflow preference heads

Revision ID: 8fdad242dfca
Revises: 804fa4f21e79, b7c1e2f3a4d5, c1285d81b7df
Create Date: 2026-07-27 14:06:34.134282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8fdad242dfca'
down_revision: Union[str, Sequence[str], None] = ('804fa4f21e79', 'b7c1e2f3a4d5', 'c1285d81b7df')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
