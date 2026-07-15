"""add contacts table and users.is_discoverable

Revision ID: b7c1e2f3a4d5
Revises: w4x5y6z7a8b9
Create Date: 2026-07-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c1e2f3a4d5'
down_revision: Union[str, Sequence[str], None] = 'w4x5y6z7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "users",
        sa.Column(
            "is_discoverable",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
    )

    op.create_table(
        "contacts",
        sa.Column("contact_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("contact_user_id", sa.Integer(), nullable=False),
        sa.Column("alias", sa.String(length=100), nullable=True),
        sa.Column("is_favorite", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("contact_id"),
        sa.UniqueConstraint("owner_user_id", "contact_user_id", name="uq_contacts_owner_contact"),
    )
    op.create_index("idx_contacts_owner_user_id", "contacts", ["owner_user_id"])
    op.create_index("idx_contacts_contact_user_id", "contacts", ["contact_user_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_contacts_contact_user_id", table_name="contacts")
    op.drop_index("idx_contacts_owner_user_id", table_name="contacts")
    op.drop_table("contacts")
    op.drop_column("users", "is_discoverable")
