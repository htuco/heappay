"""merge refund reason code and admin request notifications heads

Revision ID: 804fa4f21e79
Revises: 5b05271cdbac, x5y6z7a8b9c0
Create Date: 2026-07-14 15:10:05.783030

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '804fa4f21e79'
down_revision: Union[str, Sequence[str], None] = ('5b05271cdbac', 'x5y6z7a8b9c0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
