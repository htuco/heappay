"""add users.last_login_at

Revision ID: 0c853e642e0f
Revises: 5ef2356eb225
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0c853e642e0f"
down_revision: Union[str, Sequence[str], None] = "5ef2356eb225"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable, because NULL is meaningful: it is what the UI renders as
    # "Never". Note what is deliberately NOT used as a default -- now() or
    # created_at would both invent a login that never happened.
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        schema="identity",
    )

    # Backfill from the one place a real answer already exists: the audit log
    # has been recording login_success since well before this column did. Rows
    # with no such event stay NULL and correctly read "Never" -- this fills in
    # history where we have it rather than fabricating any.
    op.execute(
        """
        UPDATE identity.users AS u
        SET last_login_at = e.latest
        FROM (
            SELECT actor_user_id, MAX(created_at) AS latest
            FROM audit.log_events
            WHERE event_type = 'login_success' AND actor_user_id IS NOT NULL
            GROUP BY actor_user_id
        ) AS e
        WHERE e.actor_user_id = u.user_id
        """
    )


def downgrade() -> None:
    op.drop_column("users", "last_login_at", schema="identity")
