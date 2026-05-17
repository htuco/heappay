from sqlalchemy.exc import IntegrityError

from exceptions import CardStatusDuplicate, CardStatusInUse, CardStatusNotFound
from models.card_status import CardStatus
from repositories.card.card_status import CardStatusRepository


class CardStatusService:
    def __init__(self, repo: CardStatusRepository) -> None:
        self._repo = repo

    def list_all(self) -> list[CardStatus]:
        return self._repo.list_all()

    def get_by_id(self, card_status_id: int) -> CardStatus:
        row = self._repo.get_by_id(card_status_id)
        if row is None:
            raise CardStatusNotFound()
        return row

    def create(self, status_name: str) -> CardStatus:
        try:
            return self._repo.create(status_name)
        except IntegrityError as exc:
            raise CardStatusDuplicate() from exc

    def update_name(self, card_status_id: int, status_name: str) -> CardStatus:
        if self._repo.get_by_id(card_status_id) is None:
            raise CardStatusNotFound()
        other = self._repo.get_by_name(status_name)
        if other is not None and other.card_status_id != card_status_id:
            raise CardStatusDuplicate()
        try:
            return self._repo.update_name(card_status_id, status_name)
        except IntegrityError as exc:
            raise CardStatusDuplicate() from exc

    def delete(self, card_status_id: int) -> None:
        if self._repo.get_by_id(card_status_id) is None:
            raise CardStatusNotFound()
        if self._repo.count_referencing_cards(card_status_id) > 0:
            raise CardStatusInUse()
        self._repo.delete(card_status_id)
