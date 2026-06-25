"""add biometric credentials

Revision ID: k3l4m5n6o7p8
Revises: j2k3l4m5n6o7
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k3l4m5n6o7p8"
down_revision: Union[str, Sequence[str], None] = "j2k3l4m5n6o7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "biometric_credentials",
        sa.Column("credential_row_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("credential_id", sa.String(length=512), nullable=False),
        sa.Column("public_key", sa.LargeBinary(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False),
        sa.Column("aaguid", sa.String(length=64), nullable=True),
        sa.Column("device_type", sa.String(length=50), nullable=True),
        sa.Column("backed_up", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("credential_row_id"),
        sa.UniqueConstraint("credential_id", name="uq_biometric_credentials_credential_id"),
    )
    op.create_index(
        "idx_biometric_credentials_user_id",
        "biometric_credentials",
        ["user_id"],
    )

    op.create_table(
        "biometric_registration_challenges",
        sa.Column("challenge_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
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
        sa.PrimaryKeyConstraint("challenge_id"),
        sa.UniqueConstraint("challenge", name="uq_biometric_registration_challenges_challenge"),
    )
    op.create_index(
        "idx_biometric_registration_challenges_user_id",
        "biometric_registration_challenges",
        ["user_id"],
    )
    op.create_index(
        "idx_biometric_registration_challenges_expires_at",
        "biometric_registration_challenges",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_biometric_registration_challenges_expires_at",
        table_name="biometric_registration_challenges",
    )
    op.drop_index(
        "idx_biometric_registration_challenges_user_id",
        table_name="biometric_registration_challenges",
    )
    op.drop_table("biometric_registration_challenges")
    op.drop_index("idx_biometric_credentials_user_id", table_name="biometric_credentials")
    op.drop_table("biometric_credentials")
