"""restrict transaction card foreign keys on delete

Revision ID: a4c5e6f7b8d9
Revises: f9a8b7c6d5e4
Create Date: 2026-06-08 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "a4c5e6f7b8d9"
down_revision: Union[str, Sequence[str], None] = "f9a8b7c6d5e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SENDER_FK = "transactions_sender_card_id_fkey"
_RECIPIENT_FK = "transactions_recipient_card_id_fkey"


def upgrade() -> None:
    op.drop_constraint(_SENDER_FK, "transactions", type_="foreignkey")
    op.drop_constraint(_RECIPIENT_FK, "transactions", type_="foreignkey")

    op.create_foreign_key(
        _SENDER_FK,
        "transactions",
        "cards",
        ["sender_card_id"],
        ["card_id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        _RECIPIENT_FK,
        "transactions",
        "cards",
        ["recipient_card_id"],
        ["card_id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(_SENDER_FK, "transactions", type_="foreignkey")
    op.drop_constraint(_RECIPIENT_FK, "transactions", type_="foreignkey")

    op.create_foreign_key(
        _SENDER_FK,
        "transactions",
        "cards",
        ["sender_card_id"],
        ["card_id"],
    )
    op.create_foreign_key(
        _RECIPIENT_FK,
        "transactions",
        "cards",
        ["recipient_card_id"],
        ["card_id"],
    )
