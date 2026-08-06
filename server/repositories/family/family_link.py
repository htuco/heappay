from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.family_link import FamilyLink
from models.user import User

# (family_link row, the other party's user)
FamilyLinkRow = tuple[FamilyLink, User]


class FamilyLinkRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_id(self, family_link_id: int) -> FamilyLink | None:
        stmt = select(FamilyLink).where(FamilyLink.family_link_id == family_link_id)
        return self._db.scalars(stmt).first()

    def get_accepted_for_dependent(self, dependent_user_id: int) -> FamilyLink | None:
        stmt = select(FamilyLink).where(
            FamilyLink.dependent_user_id == dependent_user_id,
            FamilyLink.status == "accepted",
        )
        return self._db.scalars(stmt).first()

    def get_pending_invite(self, guardian_user_id: int, dependent_user_id: int) -> FamilyLink | None:
        stmt = select(FamilyLink).where(
            FamilyLink.guardian_user_id == guardian_user_id,
            FamilyLink.dependent_user_id == dependent_user_id,
            FamilyLink.status == "pending",
        )
        return self._db.scalars(stmt).first()

    def list_dependents_for_guardian(self, guardian_user_id: int) -> list[FamilyLinkRow]:
        stmt = (
            select(FamilyLink, User)
            .join(User, User.user_id == FamilyLink.dependent_user_id)
            .where(
                FamilyLink.guardian_user_id == guardian_user_id,
                FamilyLink.status == "accepted",
            )
            .order_by(User.first_name, User.last_name, FamilyLink.family_link_id)
        )
        return list(self._db.execute(stmt).all())

    def list_incoming_invites_for_user(self, dependent_user_id: int) -> list[FamilyLinkRow]:
        stmt = (
            select(FamilyLink, User)
            .join(User, User.user_id == FamilyLink.guardian_user_id)
            .where(
                FamilyLink.dependent_user_id == dependent_user_id,
                FamilyLink.status == "pending",
            )
            .order_by(FamilyLink.invited_at.desc())
        )
        return list(self._db.execute(stmt).all())

    def create_invite(self, *, guardian_user_id: int, dependent_user_id: int) -> FamilyLink:
        row = FamilyLink(guardian_user_id=guardian_user_id, dependent_user_id=dependent_user_id)
        try:
            self._db.add(row)
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def save(self, row: FamilyLink) -> FamilyLink:
        self._db.commit()
        self._db.refresh(row)
        return row
