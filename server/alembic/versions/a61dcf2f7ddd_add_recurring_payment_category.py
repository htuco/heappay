"""add recurring payment category

Gives a recurring rule the same optional spending category a one-off
transaction has, so the transactions the scheduler generates stop landing as
Uncategorised.

Nullable with no default and no backfill: a rule without a category is
"Uncategorised", exactly like a transaction. Existing rules keep NULL, and the
transactions they generate fall back to the keyword rules.

The FK is named explicitly (`fk_recurring_payments_transaction_category_id`,
matching the newer fk_<table>_<column> convention) rather than left to
Postgres' default, so `downgrade()` can drop it by name.

Revision ID: a61dcf2f7ddd
Revises: 87571293d0dd
Create Date: 2026-07-30 10:15:33.585271

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a61dcf2f7ddd'
down_revision: Union[str, Sequence[str], None] = '87571293d0dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FK_NAME = "fk_recurring_payments_transaction_category_id"


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'recurring_payments',
        sa.Column('transaction_category_id', sa.Integer(), nullable=True),
        schema='money',
    )
    op.create_index(
        'ix_recurring_payments_transaction_category_id',
        'recurring_payments',
        ['transaction_category_id'],
        unique=False,
        schema='money',
    )
    op.create_foreign_key(
        _FK_NAME,
        'recurring_payments',
        'transaction_categories',
        ['transaction_category_id'],
        ['transaction_category_id'],
        source_schema='money',
        referent_schema='money',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(_FK_NAME, 'recurring_payments', schema='money', type_='foreignkey')
    op.drop_index(
        'ix_recurring_payments_transaction_category_id',
        table_name='recurring_payments',
        schema='money',
    )
    op.drop_column('recurring_payments', 'transaction_category_id', schema='money')
