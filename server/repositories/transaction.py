from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from models.card import Card
from models.transaction import Transaction
from models.transaction_status import TransactionStatus
from models.transaction_type import TransactionType


class TransactionRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_for_user(
        self,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Transaction]:
        """List transactions where the user owns either the sender or recipient card."""
        stmt = (
            self._user_transactions_stmt(user_id)
            .order_by(Transaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).all())

    def count_for_user(self, *, user_id: int) -> int:
        stmt = select(func.count()).select_from(
            self._user_transactions_stmt(user_id).subquery()
        )
        return int(self._db.execute(stmt).scalar_one())

    def list_all(self, *, limit: int = 50, offset: int = 0) -> list[Transaction]:
        stmt = (
            select(Transaction)
            .order_by(Transaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).all())

    def count_all(self) -> int:
        stmt = select(func.count()).select_from(Transaction)
        return int(self._db.execute(stmt).scalar_one())

    def _user_transactions_stmt(self, user_id: int):
        user_card_ids = select(Card.card_id).where(Card.user_id == user_id)
        return select(Transaction).where(
            or_(
                Transaction.sender_card_id.in_(user_card_ids),
                Transaction.recipient_card_id.in_(user_card_ids),
            )
        )

    def get_by_id(self, transaction_id: int) -> Transaction | None:
        stmt = select(Transaction).where(Transaction.transaction_id == transaction_id)
        return self._db.scalars(stmt).first()

    def card_owner_id(self, card_id: int) -> int | None:
        stmt = select(Card.user_id).where(
            Card.card_id == card_id, Card.deleted_at.is_(None)
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def get_card_for_update(self, card_id: int) -> Card | None:
        """Lock card row for the duration of the transaction (SELECT ... FOR UPDATE)."""
        stmt = (
            select(Card)
            .where(Card.card_id == card_id, Card.deleted_at.is_(None))
            .with_for_update()
        )
        return self._db.scalars(stmt).first()

    def create_with_balance_update(
        self,
        *,
        sender_card: Card | None,
        recipient_card: Card,
        transaction_type_id: int,
        status_id: int,
        amount: Decimal,
        note: str | None,
    ) -> Transaction:
        """Atomski: smanji sender balance, povecaj recipient balance, kreiraj transaction."""
        if sender_card is not None:
            sender_card.balance = sender_card.balance - amount
        recipient_card.balance = recipient_card.balance + amount

        row = Transaction(
            sender_card_id=sender_card.card_id if sender_card is not None else None,
            recipient_card_id=recipient_card.card_id,
            transaction_type_id=transaction_type_id,
            status_id=status_id,
            amount=amount,
            note=note,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def update(self, row: Transaction, changes: dict) -> Transaction:
        for key, value in changes.items():
            setattr(row, key, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def transaction_type_exists(self, transaction_type_id: int) -> bool:
        stmt = select(TransactionType.transaction_type_id).where(
            TransactionType.transaction_type_id == transaction_type_id
        )
        return self._db.execute(stmt).first() is not None

    def transaction_status_exists(self, status_id: int) -> bool:
        stmt = select(TransactionStatus.transaction_status_id).where(
            TransactionStatus.transaction_status_id == status_id
        )
        return self._db.execute(stmt).first() is not None

    def get_status_id_by_name(self, name: str) -> int | None:
        stmt = select(TransactionStatus.transaction_status_id).where(
            TransactionStatus.name == name
        )
        return self._db.execute(stmt).scalar_one_or_none()
