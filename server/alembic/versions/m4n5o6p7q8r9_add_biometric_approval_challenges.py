"""add biometric approval challenges

Revision ID: m4n5o6p7q8r9
Revises: b6c2d3e4f5a7, k3l4m5n6o7p8
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m4n5o6p7q8r9"
down_revision: Union[str, Sequence[str], None] = ("b6c2d3e4f5a7", "k3l4m5n6o7p8")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "biometric_authentication_challenges",
        sa.Column("challenge_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("challenge", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.transaction_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("challenge_id"),
        sa.UniqueConstraint("challenge", name="uq_biometric_auth_challenges_challenge"),
    )
    op.create_index(
        "idx_biometric_auth_challenges_user_id",
        "biometric_authentication_challenges",
        ["user_id"],
    )
    op.create_index(
        "idx_biometric_auth_challenges_transaction_id",
        "biometric_authentication_challenges",
        ["transaction_id"],
    )
    op.create_index(
        "idx_biometric_auth_challenges_expires_at",
        "biometric_authentication_challenges",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_biometric_auth_challenges_expires_at",
        table_name="biometric_authentication_challenges",
    )
    op.drop_index(
        "idx_biometric_auth_challenges_transaction_id",
        table_name="biometric_authentication_challenges",
    )
    op.drop_index(
        "idx_biometric_auth_challenges_user_id",
        table_name="biometric_authentication_challenges",
    )
    op.drop_table("biometric_authentication_challenges")
