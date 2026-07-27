"""add refund reason code, drop auto approve max amount

Revision ID: 5b05271cdbac
Revises: 14a6dfb71966
Create Date: 2026-07-14 11:49:04.823343

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b05271cdbac'
down_revision: Union[str, Sequence[str], None] = '14a6dfb71966'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "refund_request_details",
        sa.Column("reason_code", sa.String(length=30), nullable=True),
    )
    op.drop_column("refund_approval_rules", "auto_approve_max_amount")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "refund_approval_rules",
        sa.Column(
            "auto_approve_max_amount",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
            server_default="25.00",
        ),
    )
    op.drop_column("refund_request_details", "reason_code")
