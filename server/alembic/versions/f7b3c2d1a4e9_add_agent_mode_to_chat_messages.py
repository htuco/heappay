"""add agent_mode to chat_messages

Splits chat history into two independent threads per user: the read-only
"Chat" (Q&A) thread and the "Actions" agent thread. Existing rows default to
``false`` so they remain visible as Chat history.

Revision ID: f7b3c2d1a4e9
Revises: e1c7a9d34f02
Create Date: 2026-06-24 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f7b3c2d1a4e9"
down_revision: Union[str, Sequence[str], None] = "e1c7a9d34f02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column("agent_mode", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(
        "ix_chat_messages_user_mode",
        "chat_messages",
        ["user_id", "agent_mode", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_user_mode", table_name="chat_messages")
    op.drop_column("chat_messages", "agent_mode")
