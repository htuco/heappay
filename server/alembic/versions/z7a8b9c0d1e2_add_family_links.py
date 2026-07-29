"""add family links

Revision ID: z7a8b9c0d1e2
Revises: 8fdad242dfca

Guardian<->dependent relationship between two existing user accounts. A
dependent may have at most one `accepted` link at a time (single guardian
per dependent in v1), enforced with a partial unique index rather than a
plain table-level unique constraint so a dependent can be re-invited after
a decline/revoke.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "z7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "8fdad242dfca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "family_links",
        sa.Column("family_link_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guardian_user_id", sa.Integer(), nullable=False),
        sa.Column("dependent_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column(
            "invited_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by_user_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["guardian_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dependent_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["revoked_by_user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("family_link_id"),
        sa.CheckConstraint(
            "guardian_user_id != dependent_user_id", name="ck_family_links_no_self_link"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'revoked')",
            name="ck_family_links_status_valid",
        ),
    )
    op.create_index("ix_family_links_guardian_user_id", "family_links", ["guardian_user_id"])
    op.create_index("ix_family_links_dependent_user_id", "family_links", ["dependent_user_id"])
    op.create_index(
        "ix_family_links_guardian_status", "family_links", ["guardian_user_id", "status"]
    )
    op.create_index(
        "uq_family_links_one_active_guardian_per_dependent",
        "family_links",
        ["dependent_user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'accepted'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_family_links_one_active_guardian_per_dependent", table_name="family_links"
    )
    op.drop_index("ix_family_links_guardian_status", table_name="family_links")
    op.drop_index("ix_family_links_dependent_user_id", table_name="family_links")
    op.drop_index("ix_family_links_guardian_user_id", table_name="family_links")
    op.drop_table("family_links")
