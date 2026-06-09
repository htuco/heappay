from datetime import datetime, timedelta, timezone

from models.transaction import Transaction
from repositories.transaction.transaction import TransactionRepository
from schemas.transaction import TransactionCreate, TransactionPatch
from settings import get_settings


class TransactionNotFoundError(Exception):
    """Transaction does not exist."""


class CardNotFoundError(Exception):
    """One of the referenced cards does not exist or is deleted."""


class TransactionTypeNotFoundError(Exception):
    """Transaction type does not exist."""


class TransactionStatusNotFoundError(Exception):
    """Transaction status does not exist."""


class InsufficientBalanceError(Exception):
    """Sender card does not have enough balance to cover the transaction."""


class ForbiddenError(Exception):
    """Authenticated user is not allowed to perform this action."""


class TransactionService:
    DEFAULT_STATUS = "pending"

    def __init__(self, repo: TransactionRepository) -> None:
        self._repo = repo

    def list_for_user(
        self,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        status_id: int | None = None,
        transaction_type_id: int | None = None,
        sort: str = "newest",
    ) -> tuple[list[Transaction], int]:
        if status_id is not None and not self._repo.transaction_status_exists(status_id):
            raise TransactionStatusNotFoundError()
        if transaction_type_id is not None and not self._repo.transaction_type_exists(
            transaction_type_id
        ):
            raise TransactionTypeNotFoundError()
        items = self._repo.list_for_user(
            user_id=user_id,
            limit=limit,
            offset=offset,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            sort=sort,
        )
        total = self._repo.count_for_user(
            user_id=user_id,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
        )
        return items, total

    def list_all(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Transaction], int]:
        items = self._repo.list_all(limit=limit, offset=offset)
        total = self._repo.count_all()
        return items, total

    def get_summary_for_user(
        self,
        *,
        user_id: int,
        months: int = 6,
    ) -> list[dict]:
        return self._repo.get_summary_for_user(user_id=user_id, months=months)

    def list_for_card(
        self,
        card_id: int,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Transaction], int]:
        """Return transactions for a specific card, after verifying the user owns it."""
        owner_id = self._repo.card_owner_id(card_id)
        if owner_id is None:
            raise CardNotFoundError()
        if owner_id != user_id:
            raise ForbiddenError()
        items = self._repo.list_for_card(card_id=card_id, limit=limit, offset=offset)
        total = self._repo.count_for_card(card_id=card_id)
        return items, total

    def get_by_id_for_user(
        self, transaction_id: int, *, user_id: int
    ) -> Transaction | None:
        row = self._repo.get_by_id(transaction_id)
        if row is None:
            return None
        if not self._user_participates(row, user_id):
            raise ForbiddenError()
        return row

    def create(self, payload: TransactionCreate, *, user_id: int) -> Transaction:
        if not self._repo.transaction_type_exists(payload.transaction_type_id):
            raise TransactionTypeNotFoundError()

        status_id = self._repo.get_status_id_by_name(self.DEFAULT_STATUS)
        if status_id is None:
            raise TransactionStatusNotFoundError()

        sender_card = None
        if payload.sender_card_id is not None:
            sender_card = self._repo.get_card_for_update(payload.sender_card_id)
            if sender_card is None:
                raise CardNotFoundError()
            if sender_card.user_id != user_id:
                raise ForbiddenError()

        recipient_card = self._repo.get_card_for_update(payload.recipient_card_id)
        if recipient_card is None:
            raise CardNotFoundError()

        if sender_card is None:
            # Deposit (no sender) must target the caller's own card
            if recipient_card.user_id != user_id:
                raise ForbiddenError()

        if sender_card is not None and sender_card.balance < payload.amount:
            raise InsufficientBalanceError()

        delay_seconds = get_settings().tx_min_processing_delay_seconds
        processing_eligible_at = datetime.now(timezone.utc) + timedelta(
            seconds=delay_seconds
        )

        return self._repo.create_with_balance_update(
            sender_card=sender_card,
            recipient_card=recipient_card,
            transaction_type_id=payload.transaction_type_id,
            status_id=status_id,
            amount=payload.amount,
            note=payload.note,
            processing_eligible_at=processing_eligible_at,
        )

    def patch(
        self, transaction_id: int, payload: TransactionPatch, *, user_id: int
    ) -> Transaction:
        row = self._repo.get_by_id(transaction_id)
        if row is None:
            raise TransactionNotFoundError()
        if not self._user_participates(row, user_id):
            raise ForbiddenError()

        changes = payload.model_dump(exclude_unset=True)
        if "status_id" in changes and not self._repo.transaction_status_exists(
            changes["status_id"]
        ):
            raise TransactionStatusNotFoundError()
        return self._repo.update(row, changes)

    def patch_as_staff(self, transaction_id: int, payload: TransactionPatch) -> Transaction:
        row = self._repo.get_by_id(transaction_id)
        if row is None:
            raise TransactionNotFoundError()

        changes = payload.model_dump(exclude_unset=True)
        if "status_id" in changes and not self._repo.transaction_status_exists(
            changes["status_id"]
        ):
            raise TransactionStatusNotFoundError()
        return self._repo.update(row, changes)

    def _user_participates(self, row: Transaction, user_id: int) -> bool:
        """True if the user owns either side of the transaction."""
        for card_id in (row.sender_card_id, row.recipient_card_id):
            if card_id is None:
                continue
            if self._repo.card_owner_id(card_id) == user_id:
                return True
        return False
