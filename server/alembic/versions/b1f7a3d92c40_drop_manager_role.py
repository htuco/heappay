"""drop manager role

Reassigns any users currently on the ``manager`` role to ``support`` (the
project standardises on user / admin / support), then removes the seeded
``manager`` row. The reassignment runs first so no user FK is left dangling.

Revision ID: b1f7a3d92c40
Revises: a5fd998c612e
Create Date: 2026-06-16 09:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b1f7a3d92c40"
down_revision: Union[str, Sequence[str], None] = "a5fd998c612e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Reassign manager users to support, then delete the manager role."""
    op.execute(
        """
        UPDATE users
        SET user_role_id = (
            SELECT role_id FROM user_roles WHERE role_name = 'support'
        )
        WHERE user_role_id = (
            SELECT role_id FROM user_roles WHERE role_name = 'manager'
        )
        """
    )

    op.execute("DELETE FROM user_roles WHERE role_name = 'manager'")


def downgrade() -> None:
    """Re-seed the manager role. Prior role assignments are not restored."""
    op.execute(
        """
        INSERT INTO user_roles (role_name)
        VALUES ('manager')
        ON CONFLICT (role_name) DO NOTHING
        """
    )
