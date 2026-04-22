"""seed reference tables

Revision ID: 4c2f9b8d1e7a
Revises: 223eb2179c9f
Create Date: 2026-04-22 13:10:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "4c2f9b8d1e7a"
down_revision: Union[str, Sequence[str], None] = "223eb2179c9f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Insert baseline lookup values in an idempotent way."""
    op.execute(
        """
        INSERT INTO user_roles (role_name)
        VALUES
            ('admin'),
            ('manager'),
            ('support'),
            ('user')
        ON CONFLICT (role_name) DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO user_statuses (status_name)
        VALUES
            ('active'),
            ('invited'),
            ('suspended'),
            ('deleted')
        ON CONFLICT (status_name) DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO card_statuses (status_name)
        VALUES
            ('active'),
            ('frozen'),
            ('expired'),
            ('cancelled')
        ON CONFLICT (status_name) DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO card_types (type_name, vendor)
        VALUES
            ('debit', 'visa'),
            ('debit', 'mastercard'),
            ('credit', 'visa'),
            ('credit', 'mastercard')
        ON CONFLICT (type_name, vendor) DO NOTHING
        """
    )


def downgrade() -> None:
    """Remove only the seeded lookup rows."""
    op.execute(
        """
        DELETE FROM card_types
        WHERE (type_name, vendor) IN (
            ('debit', 'visa'),
            ('debit', 'mastercard'),
            ('credit', 'visa'),
            ('credit', 'mastercard')
        )
        """
    )

    op.execute(
        """
        DELETE FROM card_statuses
        WHERE status_name IN ('active', 'frozen', 'expired', 'cancelled')
        """
    )

    op.execute(
        """
        DELETE FROM user_statuses
        WHERE status_name IN ('active', 'invited', 'suspended', 'deleted')
        """
    )

    op.execute(
        """
        DELETE FROM user_roles
        WHERE role_name IN ('admin', 'manager', 'support', 'user')
        """
    )
