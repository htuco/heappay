from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.card import Card
from models.card_status import CardStatus


class CardStatusRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(self) -> list[CardStatus]:
        stmt = select(CardStatus).order_by(CardStatus.card_status_id)
        return list(self._db.scalars(stmt).all())

    def get_by_id(self, card_status_id: int) -> CardStatus | None:
        stmt = select(CardStatus).where(
            CardStatus.card_status_id == card_status_id
        )
        return self._db.scalars(stmt).first()

    def get_by_name(self, status_name: str) -> CardStatus | None:
        stmt = select(CardStatus).where(CardStatus.status_name == status_name)
        return self._db.scalars(stmt).first()

    def create(self, status_name: str) -> CardStatus:
        row = CardStatus(status_name=status_name)
        self._db.add(row)
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def update_name(
        self, card_status_id: int, status_name: str
    ) -> CardStatus | None:
        row = self.get_by_id(card_status_id)
        if row is None:
            return None
        row.status_name = status_name
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def delete(self, card_status_id: int) -> bool:
        row = self.get_by_id(card_status_id)
        if row is None:
            return False
        self._db.delete(row)
        self._db.commit()
        return True

    def count_referencing_cards(self, card_status_id: int) -> int:
        count = self._db.execute(
            select(func.count()).select_from(Card).where(
                Card.status_id == card_status_id
            )
        ).scalar()
        return int(count or 0)
