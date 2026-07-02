"""add email verification

Revision ID: 0492dd1e4753
Revises: r9s0t1u2v3w4
Create Date: 2026-07-01 11:37:38.821000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0492dd1e4753'
down_revision: Union[str, Sequence[str], None] = 'r9s0t1u2v3w4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "users",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL")

    op.create_table(
        "email_verification_tokens",
        sa.Column("token_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_id"),
        sa.UniqueConstraint("token_hash", name="uq_email_verification_tokens_token_hash"),
    )
    op.create_index(
        "idx_email_verification_tokens_user_id",
        "email_verification_tokens",
        ["user_id"],
    )
    op.create_index(
        "idx_email_verification_tokens_expires_at",
        "email_verification_tokens",
        ["expires_at"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_email_verification_tokens_expires_at", table_name="email_verification_tokens")
    op.drop_index("idx_email_verification_tokens_user_id", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_column("users", "email_verified_at")
