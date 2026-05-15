from sqlalchemy.exc import IntegrityError

from models.card import Card
from models.user import User
from repositories.card import CardRepository
from schemas.card import CardCreate, CardPatch


class CardNotFoundError(Exception):
    """Card does not exist."""


class UserNotFoundError(Exception):
    """User does not exist."""


class CardStatusNotFoundError(Exception):
    """Card status does not exist."""


class CardTypeNotFoundError(Exception):
    """Card type does not exist."""


class DuplicateCardNumberError(Exception):
    """A card with this number is already registered."""


class CardService:
    def __init__(self, repo: CardRepository) -> None:
        self._repo = repo

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
        return self._repo.list_all(
            user_id=user_id,
            status_id=status_id,
            card_type_id=card_type_id,
            limit=limit,
            offset=offset,
            include_deleted=include_deleted,
        )

    def get_by_id(self, card_id: int) -> Card | None:
        return self._repo.get_by_id(card_id, include_deleted=False)

    def get_by_id_including_deleted(self, card_id: int) -> Card | None:
        return self._repo.get_by_id(card_id, include_deleted=True)

    def create(self, payload: CardCreate) -> Card:
        self._validate_fk(
            user_id=payload.user_id,
            status_id=payload.status_id,
            card_type_id=payload.card_type_id,
        )
        try:
            return self._repo.create(
                user_id=payload.user_id,
                status_id=payload.status_id,
                card_type_id=payload.card_type_id,
                card_numb=payload.card_numb,
                last_four=payload.card_numb[-4:],
                cvc=payload.cvc,
                expires_at=payload.expires_at,
                cardholder_name=payload.cardholder_name,
            )
        except IntegrityError as exc:
            if "uq_cards_card_numb" in str(exc.orig).lower() or "card_numb" in str(exc.orig).lower():
                raise DuplicateCardNumberError() from exc
            raise

    def patch(self, card_id: int, payload: CardPatch) -> Card:
        row = self._repo.get_by_id(card_id, include_deleted=False)
        if row is None:
            raise CardNotFoundError()

        changes = payload.model_dump(exclude_unset=True)
        if "user_id" in changes and not self._repo.user_exists(changes["user_id"]):
            raise UserNotFoundError()
        if "status_id" in changes and not self._repo.status_exists(changes["status_id"]):
            raise CardStatusNotFoundError()
        if "card_type_id" in changes and not self._repo.card_type_exists(
            changes["card_type_id"]
        ):
            raise CardTypeNotFoundError()
        if "card_numb" in changes:
            changes["last_four"] = changes["card_numb"][-4:]
        return self._repo.update(row, changes)

    def delete(self, card_id: int) -> None:
        row = self._repo.get_by_id(card_id, include_deleted=False)
        if row is None:
            raise CardNotFoundError()
        self._repo.soft_delete(row)

    def lookup_by_card_number(self, card_numb: str) -> tuple[Card, User] | None:
        return self._repo.lookup_by_card_number(card_numb)

    def restore(self, card_id: int) -> Card:
        row = self._repo.get_by_id(card_id, include_deleted=True)
        if row is None or row.deleted_at is None:
            raise CardNotFoundError()
        return self._repo.restore(row)

    def _validate_fk(self, *, user_id: int, status_id: int, card_type_id: int) -> None:
        if not self._repo.user_exists(user_id):
            raise UserNotFoundError()
        if not self._repo.status_exists(status_id):
            raise CardStatusNotFoundError()
        if not self._repo.card_type_exists(card_type_id):
            raise CardTypeNotFoundError()
