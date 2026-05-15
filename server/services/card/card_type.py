from sqlalchemy.exc import IntegrityError

from models.card_type import CardType
from repositories.card.card_type import CardTypeRepository


class DuplicateCardTypeError(Exception):
    """A card type/vendor combination already exists."""


class CardTypeInUseError(Exception):
    """At least one card references this card type."""


class CardTypeService:
    def __init__(self, repo: CardTypeRepository) -> None:
        self._repo = repo

    def list_all(self) -> list[CardType]:
        return self._repo.list_all()

    def get_by_id(self, card_type_id: int) -> CardType | None:
        return self._repo.get_by_id(card_type_id)

    def create(self, type_name: str, vendor: str) -> CardType:
        try:
            return self._repo.create(type_name, vendor)
        except IntegrityError as exc:
            raise DuplicateCardTypeError() from exc

    def update(
        self,
        card_type_id: int,
        *,
        type_name: str | None = None,
        vendor: str | None = None,
    ) -> CardType | None:
        existing = self._repo.get_by_id(card_type_id)
        if existing is None:
            return None

        next_type_name = type_name if type_name is not None else existing.type_name
        next_vendor = vendor if vendor is not None else existing.vendor

        conflict = self._repo.get_by_type_vendor(next_type_name, next_vendor)
        if conflict is not None and conflict.card_type_id != card_type_id:
            raise DuplicateCardTypeError()

        try:
            return self._repo.update(card_type_id, next_type_name, next_vendor)
        except IntegrityError as exc:
            raise DuplicateCardTypeError() from exc

    def delete(self, card_type_id: int) -> bool:
        if self._repo.get_by_id(card_type_id) is None:
            return False
        if self._repo.count_referencing_cards(card_type_id) > 0:
            raise CardTypeInUseError()
        self._repo.delete(card_type_id)
        return True
