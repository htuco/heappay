"""reconcile status seeds: add cancelled transaction status

Data-only reconciliation migration (no schema changes). Adds the ``cancelled``
transaction status so a user-initiated cancel reads differently from a
processor-driven failure. Also merges the two open heads
(``a8655669e567`` and ``b7c8d9e0f1a2``) into a single head.

Audit (see context/features/status-consistency-audit.md) found no genuinely
unused card or transaction status rows, so this migration is additive only —
there are no DELETEs and therefore no FK-reference risk.

Revision ID: f4a7c2e9b1d3
Revises: a8655669e567, b7c8d9e0f1a2
Create Date: 2026-06-15 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f4a7c2e9b1d3"
down_revision: Union[str, Sequence[str], None] = ("a8655669e567", "b7c8d9e0f1a2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Insert the 'cancelled' transaction status (idempotent)."""
    op.execute(
        """
        INSERT INTO transaction_statuses (name)
        VALUES ('cancelled')
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    """Remove the 'cancelled' transaction status only if no rows reference it.

    Guarded against FK references: a transaction may have been cancelled while
    this migration was applied, in which case the row must stay.
    """
    op.execute(
        """
        DELETE FROM transaction_statuses
        WHERE name = 'cancelled'
          AND transaction_status_id NOT IN (
              SELECT status_id FROM transactions WHERE status_id IS NOT NULL
          )
        """
    )
