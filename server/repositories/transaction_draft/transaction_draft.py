from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from models.card import Card
from models.transaction_draft import TransactionDraft


class TransactionDraftRepository:
    """Reads and writes drafts, and nothing else.

    There is deliberately no join to `transactions` here, and nothing in the
    transaction repository reaches for this table: that separation is what
    keeps a draft out of balances, history, summaries and the settle path
    without a single query having to remember to exclude it.
    """

    def __init__(self, db: Session) -> None:
        self._db = db

    def _commit(self) -> None:
        try:
            self._db.commit()
        except SQLAlchemyError:
            self._db.rollback()
            raise

    def _load_options(self):
        return (
            joinedload(TransactionDraft.sender_card).joinedload(Card.user),
            joinedload(TransactionDraft.sender_card).joinedload(Card.card_type),
            joinedload(TransactionDraft.recipient_card).joinedload(Card.user),
            joinedload(TransactionDraft.recipient_card).joinedload(Card.card_type),
        )

    def get_card(self, card_id: int) -> Card | None:
        """Plain card lookup for validating what a draft points at.

        Not `TransactionRepository.get_card_for_update` -- saving a draft moves
        no money, so there is nothing here worth locking a card row for.
        """
        return self._db.get(Card, card_id)

    def create(self, *, user_id: int, **fields) -> TransactionDraft:
        row = TransactionDraft(user_id=user_id, **fields)
        self._db.add(row)
        self._commit()
        self._db.refresh(row)
        return self.get_by_id(row.draft_id)

    def get_by_id(self, draft_id: int) -> TransactionDraft | None:
        stmt = (
            select(TransactionDraft)
            .options(*self._load_options())
            .where(TransactionDraft.draft_id == draft_id)
        )
        return self._db.scalars(stmt).first()

    def list_for_user(self, user_id: int) -> list[TransactionDraft]:
        stmt = (
            select(TransactionDraft)
            .options(*self._load_options())
            .where(TransactionDraft.user_id == user_id)
            .order_by(TransactionDraft.updated_at.desc(), TransactionDraft.draft_id.desc())
        )
        return list(self._db.scalars(stmt).unique().all())

    def count_for_user(self, user_id: int) -> int:
        stmt = select(func.count()).select_from(TransactionDraft).where(
            TransactionDraft.user_id == user_id
        )
        return int(self._db.scalar(stmt) or 0)

    def update(self, row: TransactionDraft, **fields) -> TransactionDraft:
        for key, value in fields.items():
            setattr(row, key, value)
        self._commit()
        self._db.refresh(row)
        return self.get_by_id(row.draft_id)

    def delete(self, row: TransactionDraft) -> None:
        self._db.delete(row)
        self._commit()
