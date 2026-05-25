"""merge heads: avatar_url + extended card vendors

Revision ID: d4e6f8a0b2c3
Revises: f2d6a9b8c3e1, c1a2b3d4e5f7
"""

from typing import Sequence, Union

revision: str = "d4e6f8a0b2c3"
down_revision: Union[str, Sequence[str], None] = (
    "f2d6a9b8c3e1",
    "c1a2b3d4e5f7",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
