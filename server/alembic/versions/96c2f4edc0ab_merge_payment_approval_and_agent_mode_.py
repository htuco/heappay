"""merge payment approval and agent mode heads

Revision ID: 96c2f4edc0ab
Revises: f7b3c2d1a4e9, h4a5b6c7d8e9
Create Date: 2026-06-25 11:11:46.927789

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '96c2f4edc0ab'
down_revision: Union[str, Sequence[str], None] = ('f7b3c2d1a4e9', 'h4a5b6c7d8e9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
