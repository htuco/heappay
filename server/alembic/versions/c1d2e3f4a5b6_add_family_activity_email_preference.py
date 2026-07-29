"""add family activity email preference

Revision ID: c1d2e3f4a5b6
Revises: c0d1e2f3a4b5

Per-user opt-out for family-package emails, following the existing
email_*_enabled column convention (default on, opt-out).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "c0d1e2f3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "email_family_activity_enabled",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "email_family_activity_enabled")
