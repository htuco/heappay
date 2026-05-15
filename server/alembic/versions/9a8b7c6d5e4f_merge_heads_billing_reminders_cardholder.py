"""merge heads: billing_reminders + cardholder_name

Revision ID: 9a8b7c6d5e4f
Revises: a7e8f9d0c1b2, e2f5c4a7b9d1
Create Date: 2026-05-14

Empty merge revision — schema changes live in the two parent revisions.
"""

from typing import Sequence, Union

revision: str = "9a8b7c6d5e4f"
down_revision: Union[str, Sequence[str], None] = ("a7e8f9d0c1b2", "e2f5c4a7b9d1")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
