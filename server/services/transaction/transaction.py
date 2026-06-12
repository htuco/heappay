from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError

from models.transaction import Transaction
from repositories.transaction.transaction import TransactionRepository, TransactionStateError
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


class InvalidTransactionTransitionError(Exception):
    """The requested status change is not allowed for this transaction."""


class ProcessingDelayNotElapsedError(Exception):
    """The transaction is still within the minimum processing delay window."""


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

    def create(self, payload: TransactionCreate, *, user_id: int) -> tuple[Transaction, bool]:
        """Create a transaction. Returns (row, created) where created is False on idempotent replay."""
        if payload.idempotency_key:
            existing = self._repo.get_by_idempotency_key(payload.idempotency_key)
            if existing is not None:
                if not self._user_participates(existing, user_id):
                    raise ForbiddenError()
                return existing, False

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

        try:
            row = self._repo.create_with_balance_update(
                sender_card=sender_card,
                recipient_card=recipient_card,
                transaction_type_id=payload.transaction_type_id,
                status_id=status_id,
                amount=payload.amount,
                note=payload.note,
                processing_eligible_at=processing_eligible_at,
                idempotency_key=payload.idempotency_key,
            )
            return row, True
        except IntegrityError as exc:
            self._repo.rollback()
            if payload.idempotency_key and self._is_idempotency_violation(exc):
                existing = self._repo.get_by_idempotency_key(payload.idempotency_key)
                if existing is not None:
                    if not self._user_participates(existing, user_id):
                        raise ForbiddenError()
                    return existing, False
            raise

    @staticmethod
    def _is_idempotency_violation(exc: IntegrityError) -> bool:
        message = str(exc.orig).lower()
        return "idempotency" in message or "uq_transactions_idempotency_key" in message

    def patch(
        self, transaction_id: int, payload: TransactionPatch, *, user_id: int
    ) -> Transaction:
        row = self._repo.get_by_id(transaction_id)
        if row is None:
            raise TransactionNotFoundError()
        if not self._user_participates(row, user_id):
            raise ForbiddenError()

        return self._apply_patch(
            row,
            payload,
            processed_by="user",
            bypass_delay=False,
        )

    def patch_as_staff(self, transaction_id: int, payload: TransactionPatch) -> Transaction:
        row = self._repo.get_by_id(transaction_id)
        if row is None:
            raise TransactionNotFoundError()

        return self._apply_patch(
            row,
            payload,
            processed_by="staff",
            bypass_delay=get_settings().tx_staff_bypass_delay,
        )

    def _apply_patch(
        self,
        row: Transaction,
        payload: TransactionPatch,
        *,
        processed_by: str,
        bypass_delay: bool,
    ) -> Transaction:
        changes = payload.model_dump(exclude_unset=True)
        new_status_id = changes.pop("status_id", None)

        if new_status_id is not None:
            if not self._repo.transaction_status_exists(new_status_id):
                raise TransactionStatusNotFoundError()
            row = self._apply_status_change(
                row,
                new_status_id,
                processed_by=processed_by,
                bypass_delay=bypass_delay,
            )

        if changes:
            row = self._repo.update(row, changes)
        return row

    def _apply_status_change(
        self,
        row: Transaction,
        new_status_id: int,
        *,
        processed_by: str,
        bypass_delay: bool,
    ) -> Transaction:
        if new_status_id == row.status_id:
            return row

        pending_id = self._repo.get_status_id_by_name("pending")
        completed_id = self._repo.get_status_id_by_name("completed")
        failed_id = self._repo.get_status_id_by_name("failed")

        if pending_id is None or completed_id is None or failed_id is None:
            raise TransactionStatusNotFoundError()
        if row.status_id != pending_id:
            raise InvalidTransactionTransitionError()
        if not self._can_process_now(row, bypass_delay=bypass_delay):
            raise ProcessingDelayNotElapsedError()

        try:
            if new_status_id == completed_id:
                return self._repo.complete(
                    row.transaction_id, processed_by=processed_by
                )
            if new_status_id == failed_id:
                reason = "STAFF_DENIED" if processed_by == "staff" else "USER_DENIED"
                return self._repo.fail(
                    row.transaction_id,
                    reason_code=reason,
                    processed_by=processed_by,
                )
        except TransactionStateError as exc:
            raise InvalidTransactionTransitionError() from exc

        raise InvalidTransactionTransitionError()

    def _can_process_now(self, row: Transaction, *, bypass_delay: bool) -> bool:
        if bypass_delay:
            return True
        eligible_at = row.processing_eligible_at
        if eligible_at.tzinfo is None:
            eligible_at = eligible_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) >= eligible_at

    def _user_participates(self, row: Transaction, user_id: int) -> bool:
        """True if the user owns either side of the transaction."""
        for card_id in (row.sender_card_id, row.recipient_card_id):
            if card_id is None:
                continue
            if self._repo.card_owner_id(card_id) == user_id:
                return True
        return False
