from datetime import date, datetime

from sqlalchemy import delete as sa_delete, or_, select, update
from sqlalchemy.orm import Session

from models.card import Card
from models.card_status import CardStatus
from models.card_type import CardType
from models.transaction import Transaction
from models.transaction_status import TransactionStatus
from models.user import User

# (Card, User) result tuple alias
CardWithOwner = tuple[Card, User]


class CardRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(
        self,
        *,
        user_id: int | None = None,
        status_id: int | None = None,
        card_type_id: int | None = None,
        limit: int = 50,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> list[Card]:
        stmt = select(Card)
        if not include_deleted:
            stmt = stmt.where(Card.deleted_at.is_(None))
        if user_id is not None:
            stmt = stmt.where(Card.user_id == user_id)
        if status_id is not None:
            stmt = stmt.where(Card.status_id == status_id)
        if card_type_id is not None:
            stmt = stmt.where(Card.card_type_id == card_type_id)
        stmt = stmt.order_by(Card.card_id).limit(limit).offset(offset)
        return list(self._db.scalars(stmt).all())

    def get_by_id(self, card_id: int, *, include_deleted: bool = False) -> Card | None:
        stmt = select(Card).where(Card.card_id == card_id)
        if not include_deleted:
            stmt = stmt.where(Card.deleted_at.is_(None))
        return self._db.scalars(stmt).first()

    def create(
        self,
        *,
        user_id: int,
        status_id: int,
        card_type_id: int,
        card_numb: str,
        last_four: str,
        cvc: str,
        expires_at: date,
        cardholder_name: str | None = None,
        is_main: bool = False,
    ) -> Card:
        if is_main:
            self._db.execute(
                update(Card)
                .where(Card.user_id == user_id, Card.deleted_at.is_(None))
                .values(is_main=False)
                .execution_options(synchronize_session=False)
            )
        row = Card(
            user_id=user_id,
            status_id=status_id,
            card_type_id=card_type_id,
            card_numb=card_numb,
            last_four=last_four,
            cvc=cvc,
            expires_at=expires_at,
            cardholder_name=cardholder_name,
            is_main=is_main,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def update(self, row: Card, changes: dict) -> Card:
        for key, value in changes.items():
            setattr(row, key, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def soft_delete(self, row: Card) -> None:
        row.deleted_at = datetime.utcnow()
        self._db.commit()

    def restore(self, row: Card) -> Card:
        row.deleted_at = None
        self._db.commit()
        self._db.refresh(row)
        return row

    def get_main_card(self, user_id: int) -> Card | None:
        stmt = (
            select(Card)
            .where(
                Card.user_id == user_id,
                Card.is_main.is_(True),
                Card.deleted_at.is_(None),
            )
        )
        return self._db.scalars(stmt).first()

    def set_main_card(self, user_id: int, card_id: int) -> Card | None:
        card = self.get_by_id(card_id, include_deleted=False)
        if card is None or card.user_id != user_id:
            return None
        self._db.execute(
            update(Card)
            .where(Card.user_id == user_id, Card.deleted_at.is_(None))
            .values(is_main=False)
            .execution_options(synchronize_session=False)
        )
        card.is_main = True
        self._db.commit()
        self._db.refresh(card)
        return card

    def _promote_next_main_card(self, user_id: int) -> None:
        """After the main card is deleted, set is_main on the next-oldest active card."""
        stmt = (
            select(Card)
            .where(Card.user_id == user_id, Card.deleted_at.is_(None))
            .order_by(Card.created_at.asc(), Card.card_id.asc())
            .limit(1)
        )
        next_card = self._db.scalars(stmt).first()
        if next_card:
            next_card.is_main = True
            self._db.commit()

    def lookup_by_card_number(self, card_numb: str) -> "CardWithOwner | None":
        """Return (Card, User) for a non-deleted card matching card_numb, or None."""
        stmt = (
            select(Card, User)
            .join(User, Card.user_id == User.user_id)
            .where(Card.card_numb == card_numb, Card.deleted_at.is_(None))
        )
        return self._db.execute(stmt).first()

    def find_by_card_number_including_deleted(self, card_numb: str) -> Card | None:
        """Return Card matching card_numb regardless of deleted_at, or None."""
        stmt = select(Card).where(Card.card_numb == card_numb)
        return self._db.scalars(stmt).first()

    def resurrect(self, row: Card, *, changes: dict) -> Card:
        """Clear deleted_at and apply provided field updates atomically."""
        if changes.get("is_main") is True:
            self._db.execute(
                update(Card)
                .where(Card.user_id == row.user_id, Card.deleted_at.is_(None))
                .values(is_main=False)
                .execution_options(synchronize_session=False)
            )
        for key, value in changes.items():
            setattr(row, key, value)
        row.deleted_at = None
        self._db.commit()
        self._db.refresh(row)
        return row

    def has_transactions(self, card_id: int) -> bool:
        """True if any transaction references this card on sender or recipient side."""
        stmt = select(Transaction.transaction_id).where(
            or_(
                Transaction.sender_card_id == card_id,
                Transaction.recipient_card_id == card_id,
            )
        ).limit(1)
        return self._db.execute(stmt).first() is not None

    def pending_card_ids_for_user(self, user_id: int) -> set[int]:
        """Set of card_ids (owned by user) that have at least one pending transaction
        on either sender or recipient side."""
        stmt = (
            select(Card.card_id)
            .join(
                Transaction,
                or_(
                    Transaction.sender_card_id == Card.card_id,
                    Transaction.recipient_card_id == Card.card_id,
                ),
            )
            .join(
                TransactionStatus,
                Transaction.status_id == TransactionStatus.transaction_status_id,
            )
            .where(
                Card.user_id == user_id,
                Card.deleted_at.is_(None),
                TransactionStatus.name == "pending",
            )
            .distinct()
        )
        return set(self._db.scalars(stmt).all())

    def has_pending_transactions(self, card_id: int) -> bool:
        """True if a pending transaction references this card on either side."""
        stmt = (
            select(Transaction.transaction_id)
            .join(
                TransactionStatus,
                Transaction.status_id == TransactionStatus.transaction_status_id,
            )
            .where(
                TransactionStatus.name == "pending",
                or_(
                    Transaction.sender_card_id == card_id,
                    Transaction.recipient_card_id == card_id,
                ),
            )
            .limit(1)
        )
        return self._db.execute(stmt).first() is not None

    def hard_delete(self, row: Card) -> None:
        """Permanently remove a card row from the database."""
        self._db.execute(sa_delete(Card).where(Card.card_id == row.card_id))
        self._db.commit()

    def user_exists(self, user_id: int) -> bool:
        stmt = select(User.user_id).where(User.user_id == user_id)
        return self._db.execute(stmt).first() is not None

    def status_exists(self, status_id: int) -> bool:
        stmt = select(CardStatus.card_status_id).where(
            CardStatus.card_status_id == status_id
        )
        return self._db.execute(stmt).first() is not None

    def card_type_exists(self, card_type_id: int) -> bool:
        stmt = select(CardType.card_type_id).where(CardType.card_type_id == card_type_id)
        return self._db.execute(stmt).first() is not None
