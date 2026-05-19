"""seed extended card vendors

Revision ID: c1a2b3d4e5f7
Revises: 9a8b7c6d5e4f
Create Date: 2026-05-19

Adds card vendors beyond the baseline visa/mastercard rows from
4c2f9b8d1e7a_seed_reference_tables. Baseline rows (ids 1-4) are not touched.

Vendor keys match frontend CARD_BRANDS (client/src/utils/paymentCard.utils.js);
'amex' is stored as 'american-express' to match cardApiAdapter BRAND_KEY_TO_DB_VENDOR.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "c1a2b3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "9a8b7c6d5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_VENDORS = [
    "visa-electron",
    "american-express",
    "discover",
    "diners-club",
    "jcb",
    "unionpay",
    "maestro",
    "elo",
    "hipercard",
]

TYPE_NAMES = ["debit", "credit"]


def upgrade() -> None:
    values = ",\n            ".join(
        f"('{t}', '{v}')" for v in NEW_VENDORS for t in TYPE_NAMES
    )
    op.execute(
        f"""
        INSERT INTO card_types (type_name, vendor)
        VALUES
            {values}
        ON CONFLICT (type_name, vendor) DO NOTHING
        """
    )


def downgrade() -> None:
    quoted = ", ".join(f"'{v}'" for v in NEW_VENDORS)
    op.execute(f"DELETE FROM card_types WHERE vendor IN ({quoted})")
