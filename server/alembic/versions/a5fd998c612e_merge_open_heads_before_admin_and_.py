"""merge open heads before admin and requests overhaul

Revision ID: a5fd998c612e
Revises: 498a1f0b9b2c, f4a7c2e9b1d3
Create Date: 2026-06-16 23:27:49.362459

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5fd998c612e'
down_revision: Union[str, Sequence[str], None] = ('498a1f0b9b2c', 'f4a7c2e9b1d3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
