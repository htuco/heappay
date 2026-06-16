"""reconcile card statuses to active/frozen/expired/cancelled

This environment was seeded with card_statuses active/blocked/inactive, but the
codebase (block/unblock, the freeze-request flow, and the client's
DISABLED_STATUSES/labels) expects active/frozen/expired/cancelled. The mismatch
made every ``frozen`` lookup fail ("frozen card status is not configured").

This data-only migration:
  * renames ``blocked`` -> ``frozen`` (any card already on that row stays valid),
  * removes the stray ``inactive`` row if nothing references it,
  * inserts the missing ``expired`` and ``cancelled`` rows.

Idempotent: each step is guarded so re-running (or running on an already-correct
DB) is a no-op.

Revision ID: d9b2f4e10c83
Revises: c4e8a1b6f730
Create Date: 2026-06-17 09:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "d9b2f4e10c83"
down_revision: Union[str, Sequence[str], None] = "c4e8a1b6f730"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. blocked -> frozen (only if 'frozen' doesn't already exist, so we never
    #    create a duplicate name).
    op.execute(
        """
        UPDATE card_statuses
        SET status_name = 'frozen'
        WHERE status_name = 'blocked'
          AND NOT EXISTS (
              SELECT 1 FROM card_statuses WHERE status_name = 'frozen'
          )
        """
    )

    # 2. add the missing lifecycle statuses.
    op.execute(
        """
        INSERT INTO card_statuses (status_name)
        VALUES ('expired'), ('cancelled')
        ON CONFLICT (status_name) DO NOTHING
        """
    )

    # 3. drop the stray 'inactive' row only if no card references it.
    op.execute(
        """
        DELETE FROM card_statuses cs
        WHERE cs.status_name = 'inactive'
          AND NOT EXISTS (
              SELECT 1 FROM cards c WHERE c.status_id = cs.card_status_id
          )
        """
    )


def downgrade() -> None:
    # Best-effort reverse: frozen -> blocked, re-add 'inactive', drop the
    # statuses this migration added (only when unreferenced).
    op.execute(
        """
        UPDATE card_statuses
        SET status_name = 'blocked'
        WHERE status_name = 'frozen'
          AND NOT EXISTS (
              SELECT 1 FROM card_statuses WHERE status_name = 'blocked'
          )
        """
    )
    op.execute(
        """
        INSERT INTO card_statuses (status_name)
        VALUES ('inactive')
        ON CONFLICT (status_name) DO NOTHING
        """
    )
    op.execute(
        """
        DELETE FROM card_statuses cs
        WHERE cs.status_name IN ('expired', 'cancelled')
          AND NOT EXISTS (
              SELECT 1 FROM cards c WHERE c.status_id = cs.card_status_id
          )
        """
    )
