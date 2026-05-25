"""merge heads: refund requests + avatar/card vendor migrations

Revision ID: e3f4a5b6c7d8
Revises: a1b2c3d4e5f6, d4e6f8a0b2c3
"""

from typing import Sequence, Union

revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, Sequence[str], None] = (
    "a1b2c3d4e5f6",
    "d4e6f8a0b2c3",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
