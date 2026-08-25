"""merge display currency and money request heads

Both branches added to `identity.users` independently off a581780c743e:
display_currency here, last_login_at plus the money_request_details table on
main. The changes don't overlap, so this is a pure join with no DDL of its own.

A merge revision rather than re-pointing display_currency's down_revision: any
database that already has display_currency applied can upgrade straight through
this, whereas re-pointing would leave it stranded and never apply main's two.

Revision ID: 3f1507ec80f4
Revises: d9c4e1f70b25, 0c853e642e0f
Create Date: 2026-08-25 10:38:41.628670

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f1507ec80f4'
down_revision: Union[str, Sequence[str], None] = ('d9c4e1f70b25', '0c853e642e0f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
