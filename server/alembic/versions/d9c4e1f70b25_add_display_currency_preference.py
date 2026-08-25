"""add display currency preference

Revision ID: d9c4e1f70b25
Revises: a581780c743e

The currency the app renders amounts in. Display only -- stored balances and
transaction amounts stay in the account's real currency, and nothing about
creation or settlement reads this column.

Server-side rather than device-local (unlike theme and balance scope) because
a currency expectation belongs to the person, not the browser: someone who
reads in BAM wants BAM on their phone too.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d9c4e1f70b25"
down_revision: Union[str, Sequence[str], None] = "a581780c743e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "display_currency",
            sa.String(length=3),
            nullable=False,
            server_default="USD",
        ),
        schema="identity",
    )


def downgrade() -> None:
    op.drop_column("users", "display_currency", schema="identity")
