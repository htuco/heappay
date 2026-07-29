from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.family_card_member import FamilyCardMember
from models.user import User

# (family_card_member row, the member's user)
FamilyCardMemberRow = tuple[FamilyCardMember, User]


class FamilyCardMemberRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def is_member(self, *, card_id: int, dependent_user_id: int) -> bool:
        stmt = select(FamilyCardMember.family_card_member_id).where(
            FamilyCardMember.card_id == card_id,
            FamilyCardMember.dependent_user_id == dependent_user_id,
        )
        return self._db.execute(stmt).scalar_one_or_none() is not None

    def get(self, *, card_id: int, dependent_user_id: int) -> FamilyCardMember | None:
        stmt = select(FamilyCardMember).where(
            FamilyCardMember.card_id == card_id,
            FamilyCardMember.dependent_user_id == dependent_user_id,
        )
        return self._db.scalars(stmt).first()

    def list_for_card(self, card_id: int) -> list[FamilyCardMemberRow]:
        stmt = (
            select(FamilyCardMember, User)
            .join(User, User.user_id == FamilyCardMember.dependent_user_id)
            .where(FamilyCardMember.card_id == card_id)
            .order_by(User.first_name, User.last_name, FamilyCardMember.family_card_member_id)
        )
        return list(self._db.execute(stmt).all())

    def list_cards_for_member(self, dependent_user_id: int) -> list[int]:
        stmt = select(FamilyCardMember.card_id).where(
            FamilyCardMember.dependent_user_id == dependent_user_id
        )
        return list(self._db.scalars(stmt).all())

    def add(self, *, card_id: int, dependent_user_id: int, added_by_user_id: int) -> FamilyCardMember:
        row = FamilyCardMember(
            card_id=card_id,
            dependent_user_id=dependent_user_id,
            added_by_user_id=added_by_user_id,
        )
        try:
            self._db.add(row)
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def remove(self, row: FamilyCardMember) -> None:
        self._db.delete(row)
        self._db.commit()
