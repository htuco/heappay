"""merge_heads_before_2fa

Revision ID: 67db23ad4b87
Revises: a8655669e567, b7c8d9e0f1a2
Create Date: 2026-06-15 10:56:27.694402

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '67db23ad4b87'
down_revision: Union[str, Sequence[str], None] = ('a8655669e567', 'b7c8d9e0f1a2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
