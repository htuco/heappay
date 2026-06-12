"""merge transaction processing, idempotency, and chat heads

Revision ID: a8655669e567
Revises: a4c5e6f7b8d9, g3a1b2c3d4e5, b09631a59de3
Create Date: 2026-06-12 16:42:36.836690

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8655669e567'
down_revision: Union[str, Sequence[str], None] = ('a4c5e6f7b8d9', 'g3a1b2c3d4e5', 'b09631a59de3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
