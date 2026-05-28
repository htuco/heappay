"""add requests, request_types, request_statuses, refund_request_details

Revision ID: a1b2c3d4e5f6
Revises: e2f5c4a7b9d1
Create Date: 2026-05-18 11:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "9a8b7c6d5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "request_types",
        sa.Column("request_type_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("request_type_id"),
        sa.UniqueConstraint("name"),
    )

    op.execute(
        """
        INSERT INTO request_types (name) VALUES
            ('refund'),
            ('money_request')
        ON CONFLICT (name) DO NOTHING
        """
    )

    op.create_table(
        "request_statuses",
        sa.Column("request_status_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("request_status_id"),
        sa.UniqueConstraint("name"),
    )

    op.execute(
        """
        INSERT INTO request_statuses (name) VALUES
            ('pending'),
            ('approved'),
            ('declined'),
            ('cancelled')
        ON CONFLICT (name) DO NOTHING
        """
    )

    op.create_table(
        "requests",
        sa.Column("request_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("request_type_id", sa.Integer(), nullable=False),
        sa.Column("request_status_id", sa.Integer(), nullable=False),
        sa.Column("requester_user_id", sa.Integer(), nullable=False),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["request_type_id"], ["request_types.request_type_id"]),
        sa.ForeignKeyConstraint(["request_status_id"], ["request_statuses.request_status_id"]),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.user_id"]),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("request_id"),
    )

    op.create_index("idx_requests_requester", "requests", ["requester_user_id"])
    op.create_index("idx_requests_status_type", "requests", ["request_status_id", "request_type_id"])

    op.create_table(
        "refund_request_details",
        sa.Column("request_id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["request_id"], ["requests.request_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.transaction_id"]),
        sa.PrimaryKeyConstraint("request_id"),
        sa.UniqueConstraint("transaction_id", name="uq_refund_request_per_transaction"),
    )


def downgrade() -> None:
    op.drop_table("refund_request_details")
    op.drop_index("idx_requests_status_type", table_name="requests")
    op.drop_index("idx_requests_requester", table_name="requests")
    op.drop_table("requests")
    op.drop_table("request_statuses")
    op.drop_table("request_types")
