from sqlalchemy import select
from sqlalchemy.orm import Session

from models.transaction_type import TransactionType


class TransactionTypeRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(self) -> list[TransactionType]:
        stmt = select(TransactionType).order_by(TransactionType.transaction_type_id)
        return list(self._db.scalars(stmt).all())

    def get_by_id(self, transaction_type_id: int) -> TransactionType | None:
        stmt = select(TransactionType).where(
            TransactionType.transaction_type_id == transaction_type_id
        )
        return self._db.scalars(stmt).first()
