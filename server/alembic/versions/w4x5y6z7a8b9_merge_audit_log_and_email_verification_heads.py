"""merge audit log and email verification heads

Revision ID: w4x5y6z7a8b9
Revises: e27872d74c90, v3w4x5y6z7a8

Also repairs fallout from the duplicated revision ID t1u2v3w4x5y6: databases
that applied add_audit_log_events under that ID were stamped as if
add_wallet_balance_to_users had run, so users.wallet_balance may be missing.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "w4x5y6z7a8b9"
down_revision: Union[str, Sequence[str], None] = ("e27872d74c90", "v3w4x5y6z7a8")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = sa.inspect(op.get_bind()).get_columns("users")
    if not any(column["name"] == "wallet_balance" for column in columns):
        op.add_column(
            "users",
            sa.Column(
                "wallet_balance",
                sa.Numeric(precision=12, scale=2),
                server_default="0",
                nullable=False,
            ),
        )


def downgrade() -> None:
    pass
