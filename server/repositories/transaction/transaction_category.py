from sqlalchemy import select
from sqlalchemy.orm import Session

from models.transaction_category import TransactionCategory


class TransactionCategoryRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(self) -> list[TransactionCategory]:
        stmt = select(TransactionCategory).order_by(
            TransactionCategory.transaction_category_id
        )
        return list(self._db.scalars(stmt).all())

    def get_by_id(self, transaction_category_id: int) -> TransactionCategory | None:
        stmt = select(TransactionCategory).where(
            TransactionCategory.transaction_category_id == transaction_category_id
        )
        return self._db.scalars(stmt).first()

    def exists(self, transaction_category_id: int) -> bool:
        stmt = select(TransactionCategory.transaction_category_id).where(
            TransactionCategory.transaction_category_id == transaction_category_id
        )
        return self._db.execute(stmt).first() is not None
