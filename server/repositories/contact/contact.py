from sqlalchemy import Select, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.card import Card
from models.card_status import CardStatus
from models.card_type import CardType
from models.contact import Contact
from models.user import User

# (contact row, contact's user, their default card | None, card vendor | None)
ContactRow = tuple[Contact, User, Card | None, str | None]


class ContactRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def _base_query(self) -> Select[ContactRow]:
        # The contact's current default (active) card, mirroring user search so
        # each contact carries the info needed for quick send.
        default_card_id = (
            select(Card.card_id)
            .join(CardStatus, Card.status_id == CardStatus.card_status_id)
            .where(
                Card.user_id == User.user_id,
                Card.deleted_at.is_(None),
                CardStatus.status_name.ilike("active"),
            )
            .order_by(Card.created_at, Card.card_id)
            .limit(1)
            .correlate(User)
            .scalar_subquery()
        )
        return (
            select(Contact, User, Card, CardType.vendor)
            .select_from(Contact)
            .join(User, User.user_id == Contact.contact_user_id)
            .outerjoin(Card, Card.card_id == default_card_id)
            .outerjoin(CardType, Card.card_type_id == CardType.card_type_id)
            .where(User.deleted_at.is_(None))
        )

    def list_for_owner(self, owner_id: int, q: str | None = None) -> list[ContactRow]:
        stmt = self._base_query().where(Contact.owner_user_id == owner_id)
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(
                or_(
                    Contact.alias.ilike(pattern),
                    User.email.ilike(pattern),
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                )
            )
        stmt = stmt.order_by(
            Contact.is_favorite.desc(),
            User.first_name,
            User.last_name,
            Contact.contact_id,
        )
        return list(self._db.execute(stmt).all())

    def get_row(self, owner_id: int, contact_id: int) -> ContactRow | None:
        stmt = self._base_query().where(
            Contact.owner_user_id == owner_id,
            Contact.contact_id == contact_id,
        )
        return self._db.execute(stmt).first()

    def get(self, owner_id: int, contact_id: int) -> Contact | None:
        stmt = select(Contact).where(
            Contact.owner_user_id == owner_id,
            Contact.contact_id == contact_id,
        )
        return self._db.scalars(stmt).first()

    def get_by_pair(self, owner_id: int, contact_user_id: int) -> Contact | None:
        stmt = select(Contact).where(
            Contact.owner_user_id == owner_id,
            Contact.contact_user_id == contact_user_id,
        )
        return self._db.scalars(stmt).first()

    def add(self, row: Contact) -> Contact:
        try:
            self._db.add(row)
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def save(self, row: Contact) -> Contact:
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete(self, row: Contact) -> None:
        self._db.delete(row)
        self._db.commit()
