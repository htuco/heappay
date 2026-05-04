from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.card import Card
from models.card_type import CardType


class CardTypeRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(self) -> list[CardType]:
        stmt = select(CardType).order_by(CardType.card_type_id)
        return list(self._db.scalars(stmt))

    def get_by_id(self, card_type_id: int) -> CardType | None:
        stmt = select(CardType).where(CardType.card_type_id == card_type_id)
        return self._db.scalars(stmt).first()

    def get_by_type_vendor(self, type_name: str, vendor: str) -> CardType | None:
        stmt = select(CardType).where(
            CardType.type_name == type_name,
            CardType.vendor == vendor,
        )
        return self._db.scalars(stmt).first()

    def create(self, type_name: str, vendor: str) -> CardType:
        row = CardType(type_name=type_name, vendor=vendor)
        self._db.add(row)
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def update(
        self, card_type_id: int, type_name: str, vendor: str
    ) -> CardType | None:
        row = self.get_by_id(card_type_id)
        if row is None:
            return None
        row.type_name = type_name
        row.vendor = vendor
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def delete(self, card_type_id: int) -> bool:
        row = self.get_by_id(card_type_id)
        if row is None:
            return False
        self._db.delete(row)
        self._db.commit()
        return True

    def count_referencing_cards(self, card_type_id: int) -> int:
        count = self._db.execute(
            select(func.count()).select_from(Card).where(Card.card_type_id == card_type_id)
        ).scalar()
        return int(count or 0)
