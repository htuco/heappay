from sqlalchemy.exc import IntegrityError

from models.contact import Contact
from repositories.contact.contact import ContactRepository, ContactRow
from repositories.user.user import UserRepository
from schemas.contact import ContactCreate, ContactResponse, ContactUpdate
from schemas.user.crud import UserSearchDefaultCard
from services.storage.avatar_display_url import resolve_avatar_url_for_client
from settings import get_settings


class ContactError(Exception):
    """A contact operation could not be completed."""


class ContactNotFoundError(ContactError):
    """The contact does not exist for this owner."""


class ContactExistsError(ContactError):
    """This person is already in the owner's contacts."""


class InvalidContactError(ContactError):
    """The target user cannot be added as a contact."""


class ContactService:
    def __init__(self, repo: ContactRepository, user_repo: UserRepository) -> None:
        self._repo = repo
        self._user_repo = user_repo

    def list_contacts(self, owner_id: int, q: str | None = None) -> list[ContactResponse]:
        rows = self._repo.list_for_owner(owner_id, q=q.strip() if q else None)
        return [self._to_response(row) for row in rows]

    def add_contact(self, owner_id: int, payload: ContactCreate) -> ContactResponse:
        target_id = payload.contact_user_id
        if target_id == owner_id:
            raise InvalidContactError("You cannot add yourself as a contact.")

        target = self._user_repo.get_by_id(target_id)
        if target is None or target.deleted_at is not None:
            raise InvalidContactError("That user does not exist.")

        if self._repo.get_by_pair(owner_id, target_id) is not None:
            raise ContactExistsError("This person is already in your contacts.")

        alias = payload.alias.strip() if payload.alias else None
        row = Contact(
            owner_user_id=owner_id,
            contact_user_id=target_id,
            alias=alias or None,
        )
        try:
            created = self._repo.add(row)
        except IntegrityError as exc:  # unique constraint race → treat as existing
            raise ContactExistsError("This person is already in your contacts.") from exc

        fetched = self._repo.get_row(owner_id, created.contact_id)
        if fetched is None:
            raise ContactNotFoundError("Contact could not be loaded.")
        return self._to_response(fetched)

    def update_contact(
        self, owner_id: int, contact_id: int, payload: ContactUpdate
    ) -> ContactResponse:
        row = self._repo.get(owner_id, contact_id)
        if row is None:
            raise ContactNotFoundError("Contact not found.")

        if payload.alias is not None:
            alias = payload.alias.strip()
            row.alias = alias or None
        if payload.is_favorite is not None:
            row.is_favorite = payload.is_favorite
        self._repo.save(row)

        fetched = self._repo.get_row(owner_id, contact_id)
        if fetched is None:
            raise ContactNotFoundError("Contact not found.")
        return self._to_response(fetched)

    def remove_contact(self, owner_id: int, contact_id: int) -> None:
        row = self._repo.get(owner_id, contact_id)
        if row is None:
            raise ContactNotFoundError("Contact not found.")
        self._repo.delete(row)

    def _to_response(self, row: ContactRow) -> ContactResponse:
        contact, user, card, vendor = row
        settings = get_settings()
        default_card = None
        if card is not None:
            default_card = UserSearchDefaultCard(
                card_id=card.card_id,
                last_four=card.last_four,
                vendor=vendor or "unknown",
            )
        full_name = f"{user.first_name} {user.last_name}".strip()
        return ContactResponse(
            contact_id=contact.contact_id,
            user_id=user.user_id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            avatar_url=resolve_avatar_url_for_client(user.avatar_url, settings),
            alias=contact.alias,
            display_name=contact.alias or full_name,
            is_favorite=contact.is_favorite,
            default_card=default_card,
            created_at=contact.created_at,
        )
