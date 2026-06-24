"""extend recurring payment schedule: day to 31, add months

Revision ID: j2k3l4m5n6o7
Revises: i1j2k3l4m5n6
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "j2k3l4m5n6o7"
down_revision: Union[str, Sequence[str], None] = "i1j2k3l4m5n6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_recurring_payments_day_of_month", "recurring_payments", type_="check")
    op.create_check_constraint(
        "ck_recurring_payments_day_of_month",
        "recurring_payments",
        "day_of_month BETWEEN 1 AND 31",
    )
    op.add_column(
        "recurring_payments",
        sa.Column("months", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("recurring_payments", "months")
    op.drop_constraint("ck_recurring_payments_day_of_month", "recurring_payments", type_="check")
    op.create_check_constraint(
        "ck_recurring_payments_day_of_month",
        "recurring_payments",
        "day_of_month BETWEEN 1 AND 28",
    )
