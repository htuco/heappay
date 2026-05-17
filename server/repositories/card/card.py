from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.card import Card
from models.card_status import CardStatus
from models.card_type import CardType
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
    ) -> Card:
        row = Card(
            user_id=user_id,
            status_id=status_id,
            card_type_id=card_type_id,
            card_numb=card_numb,
            last_four=last_four,
            cvc=cvc,
            expires_at=expires_at,
            cardholder_name=cardholder_name,
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

    def lookup_by_card_number(self, card_numb: str) -> "CardWithOwner | None":
        """Return (Card, User) for a non-deleted card matching card_numb, or None."""
        stmt = (
            select(Card, User)
            .join(User, Card.user_id == User.user_id)
            .where(Card.card_numb == card_numb, Card.deleted_at.is_(None))
        )
        return self._db.execute(stmt).first()

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
