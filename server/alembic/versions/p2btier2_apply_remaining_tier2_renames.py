"""apply remaining tier 2 column renames

Completes the Tier 2 naming set that Phase 2 left behind:

- transactions.processed_by -> processed_by_actor
    The column is a varchar label ('system' / 'auto' / 'admin'), not a user
    reference, but `processed_by` reads exactly like an FK to users. This is the
    one column name in the schema that actively misleads.
- recurring_payments.months -> active_months
    `months` says nothing about what the value means.
- biometric_credentials.backed_up -> is_backed_up
- chat_messages.agent_mode -> is_agent_mode
    Both are booleans; the schema uses an `is_` prefix elsewhere (is_main,
    is_favorite, is_discoverable).

RENAME COLUMN is catalog-only -- no table rewrite -- but takes a brief
ACCESS EXCLUSIVE lock per table.

Revision ID: p2btier2
Revises: p2schemagroup
"""
from typing import Sequence, Union

from alembic import op

revision: str = "p2btier2"
down_revision: Union[str, Sequence[str], None] = "p2schemagroup"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE money.transactions RENAME COLUMN processed_by TO processed_by_actor")
    op.execute("ALTER TABLE money.recurring_payments RENAME COLUMN months TO active_months")
    op.execute("ALTER TABLE security.biometric_credentials RENAME COLUMN backed_up TO is_backed_up")
    op.execute("ALTER TABLE audit.chat_messages RENAME COLUMN agent_mode TO is_agent_mode")


def downgrade() -> None:
    op.execute("ALTER TABLE audit.chat_messages RENAME COLUMN is_agent_mode TO agent_mode")
    op.execute("ALTER TABLE security.biometric_credentials RENAME COLUMN is_backed_up TO backed_up")
    op.execute("ALTER TABLE money.recurring_payments RENAME COLUMN active_months TO months")
    op.execute("ALTER TABLE money.transactions RENAME COLUMN processed_by_actor TO processed_by")
