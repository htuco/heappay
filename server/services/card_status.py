from sqlalchemy.exc import IntegrityError

from models.card_status import CardStatus
from repositories.card_status import CardStatusRepository


class DuplicateStatusNameError(Exception):
    """Another card status already uses this name."""


class StatusInUseError(Exception):
    """At least one card references this status."""


class CardStatusService:
    def __init__(self, repo: CardStatusRepository) -> None:
        self._repo = repo

    def list_all(self) -> list[CardStatus]:
        return self._repo.list_all()

    def get_by_id(self, card_status_id: int) -> CardStatus | None:
        return self._repo.get_by_id(card_status_id)

    def create(self, status_name: str) -> CardStatus:
        try:
            return self._repo.create(status_name)
        except IntegrityError as exc:
            raise DuplicateStatusNameError() from exc

    def update_name(self, card_status_id: int, status_name: str) -> CardStatus | None:
        existing = self._repo.get_by_id(card_status_id)
        if existing is None:
            return None
        other = self._repo.get_by_name(status_name)
        if other is not None and other.card_status_id != card_status_id:
            raise DuplicateStatusNameError()
        try:
            return self._repo.update_name(card_status_id, status_name)
        except IntegrityError as exc:
            raise DuplicateStatusNameError() from exc

    def delete(self, card_status_id: int) -> bool:
        if self._repo.get_by_id(card_status_id) is None:
            return False
        if self._repo.count_referencing_cards(card_status_id) > 0:
            raise StatusInUseError()
        self._repo.delete(card_status_id)
        return True
