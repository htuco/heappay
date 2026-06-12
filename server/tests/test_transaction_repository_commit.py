"""TransactionRepository rolls back the session when commit fails."""
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import SQLAlchemyError

from models.transaction import Transaction
from repositories.transaction.transaction import TransactionRepository


def test_commit_failure_triggers_rollback() -> None:
    db = MagicMock()
    db.commit.side_effect = SQLAlchemyError("connection lost")
    repo = TransactionRepository(db)

    with pytest.raises(SQLAlchemyError):
        repo._commit()

    db.rollback.assert_called_once()


def test_update_rolls_back_when_commit_fails() -> None:
    db = MagicMock()
    db.commit.side_effect = SQLAlchemyError("connection lost")
    repo = TransactionRepository(db)
    row = Transaction(
        transaction_id=1,
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=1,
        status_id=1,
        amount=Decimal("10.00"),
        note=None,
    )

    with pytest.raises(SQLAlchemyError):
        repo.update(row, {"note": "updated"})

    db.rollback.assert_called_once()
