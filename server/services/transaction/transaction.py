from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy.exc import IntegrityError

from models.transaction import Transaction
from repositories.payment_approval.payment_approval import PaymentApprovalRepository
from repositories.transaction.category_rule import CategoryRuleRepository
from repositories.transaction.transaction import TransactionRepository, TransactionStateError
from repositories.user.auth import UserAuthRepository
from schemas.transaction import TransactionApproveRequest, TransactionCreate, TransactionPatch
from settings import get_settings
from utils.totp import decrypt_secret, verify_totp_code


class TransactionNotFoundError(Exception):
    """Transaction does not exist."""


class CardNotFoundError(Exception):
    """One of the referenced cards does not exist or is deleted."""


class TransactionTypeNotFoundError(Exception):
    """Transaction type does not exist."""


class TransactionStatusNotFoundError(Exception):
    """Transaction status does not exist."""


class TransactionCategoryNotFoundError(Exception):
    """Transaction category does not exist."""


class InsufficientBalanceError(Exception):
    """Sender card does not have enough balance to cover the transaction."""


class ForbiddenError(Exception):
    """Authenticated user is not allowed to perform this action."""


class InvalidTransactionTransitionError(Exception):
    """The requested status change is not allowed for this transaction."""


class ProcessingDelayNotElapsedError(Exception):
    """The transaction is still within the minimum processing delay window."""


class DuplicatePaymentError(Exception):
    """A similar payment was already submitted within the duplicate window."""


class ApprovalRequiredError(Exception):
    """Step-up verification failed or approval is not allowed."""


class ApprovalExpiredError(Exception):
    """The in-app approval window has expired."""


class CardFrozenError(Exception):
    """A frozen card cannot send or receive money.

    ``side`` is "sender" or "recipient" so the route can return a precise
    message.
    """

    def __init__(self, side: str) -> None:
        self.side = side
        super().__init__(f"The {side} card is frozen.")


class TransactionService:
    DEFAULT_STATUS = "pending"
    FROZEN_CARD_STATUS = "frozen"

    def __init__(
        self,
        repo: TransactionRepository,
        approval_repo: PaymentApprovalRepository | None = None,
        auth_repo: UserAuthRepository | None = None,
        category_rule_repo: "CategoryRuleRepository | None" = None,
    ) -> None:
        self._repo = repo
        self._approval_repo = approval_repo or PaymentApprovalRepository(repo._db)
        self._auth_repo = auth_repo
        self._category_rule_repo = category_rule_repo or CategoryRuleRepository(repo._db)

    def list_for_user(
        self,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        status_id: int | None = None,
        transaction_type_id: int | None = None,
        category_id: int | None = None,
        sort: str = "newest",
    ) -> tuple[list[Transaction], int]:
        if status_id is not None and not self._repo.transaction_status_exists(status_id):
            raise TransactionStatusNotFoundError()
        if transaction_type_id is not None and not self._repo.transaction_type_exists(
            transaction_type_id
        ):
            raise TransactionTypeNotFoundError()
        if category_id is not None and not self._repo.transaction_category_exists(
            category_id
        ):
            raise TransactionCategoryNotFoundError()
        items = self._repo.list_for_user(
            user_id=user_id,
            limit=limit,
            offset=offset,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
            sort=sort,
        )
        total = self._repo.count_for_user(
            user_id=user_id,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
        )
        return items, total

    def list_all(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        status_id: int | None = None,
        transaction_type_id: int | None = None,
        category_id: int | None = None,
        sort: str = "newest",
    ) -> tuple[list[Transaction], int]:
        if status_id is not None and not self._repo.transaction_status_exists(status_id):
            raise TransactionStatusNotFoundError()
        if transaction_type_id is not None and not self._repo.transaction_type_exists(
            transaction_type_id
        ):
            raise TransactionTypeNotFoundError()
        if category_id is not None and not self._repo.transaction_category_exists(
            category_id
        ):
            raise TransactionCategoryNotFoundError()
        items = self._repo.list_all(
            limit=limit,
            offset=offset,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
            sort=sort,
        )
        total = self._repo.count_all(
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
        )
        return items, total

    def get_platform_stats(self, *, months: int = 6) -> dict:
        return self._repo.get_platform_stats(months=months)

    def get_summary_for_user(
        self,
        *,
        user_id: int,
        months: int = 6,
    ) -> list[dict]:
        return self._repo.get_summary_for_user(user_id=user_id, months=months)

    def get_category_breakdown_for_user(
        self,
        *,
        user_id: int,
        months: int = 6,
    ) -> list[dict]:
        return self._repo.get_category_breakdown_for_user(
            user_id=user_id, months=months
        )

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

    def get_by_id_staff(self, transaction_id: int) -> Transaction | None:
        """(Staff) Fetch any transaction by id, with no ownership check."""
        return self._repo.get_by_id(transaction_id)

    def create(self, payload: TransactionCreate, *, user_id: int) -> tuple[Transaction, bool]:
        """Create a transaction. Returns (row, created) where created is False on idempotent replay."""
        if payload.idempotency_key:
            existing = self._repo.get_by_idempotency_key(payload.idempotency_key)
            if existing is not None:
                if not self._user_participates(existing, user_id):
                    raise ForbiddenError()
                return existing, False

        if payload.sender_card_id is not None:
            window = get_settings().tx_duplicate_window_seconds
            duplicate = self._repo.find_recent_duplicate(
                sender_card_id=payload.sender_card_id,
                recipient_card_id=payload.recipient_card_id,
                amount=payload.amount,
                window_seconds=window,
            )
            if duplicate is not None:
                raise DuplicatePaymentError()

        if not self._repo.transaction_type_exists(payload.transaction_type_id):
            raise TransactionTypeNotFoundError()

        if payload.category_id is not None and not self._repo.transaction_category_exists(
            payload.category_id
        ):
            raise TransactionCategoryNotFoundError()

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

        # A frozen card can neither send nor receive money. Resolve the status
        # id by name (ids are not stable across environments).
        frozen_status_id = self._repo.get_card_status_id_by_name(self.FROZEN_CARD_STATUS)
        if frozen_status_id is not None:
            if sender_card is not None and sender_card.status_id == frozen_status_id:
                raise CardFrozenError("sender")
            if recipient_card.status_id == frozen_status_id:
                raise CardFrozenError("recipient")

        if sender_card is not None and sender_card.balance < payload.amount:
            raise InsufficientBalanceError()

        delay_seconds = get_settings().tx_min_processing_delay_seconds
        processing_eligible_at = datetime.now(timezone.utc) + timedelta(
            seconds=delay_seconds
        )

        # Auto-categorisation (Phase 2): only when the user did not pick a
        # category. An explicit choice always wins — rules never override it.
        category_id = payload.category_id
        if category_id is None:
            recipient_name = self._recipient_name(recipient_card)
            category_id = self._resolve_auto_category(
                user_id=user_id,
                note=payload.note,
                recipient_name=recipient_name,
            )

        type_name = self._repo.get_transaction_type_name(payload.transaction_type_id) or ""
        requires_approval = self._requires_user_approval(payload, type_name)
        approval_expires_at = None
        if requires_approval:
            timeout_minutes = get_settings().tx_user_approval_timeout_minutes
            approval_expires_at = datetime.now(timezone.utc) + timedelta(
                minutes=timeout_minutes
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
                category_id=category_id,
                idempotency_key=payload.idempotency_key,
                requires_user_approval=requires_approval,
                user_approval_expires_at=approval_expires_at,
            )
            if requires_approval:
                self._approval_repo.record_event(
                    transaction_id=row.transaction_id,
                    event_type="created",
                    actor_user_id=user_id,
                    detail="Awaiting in-app approval",
                )
                self._repo._db.commit()
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

    def approve(
        self,
        transaction_id: int,
        payload: TransactionApproveRequest,
        *,
        user_id: int,
    ) -> Transaction:
        row = self._repo.get_by_id(transaction_id)
        if row is None:
            raise TransactionNotFoundError()
        if not self._user_is_sender(row, user_id):
            raise ForbiddenError()
        if not row.requires_user_approval:
            raise ApprovalRequiredError("This transaction does not require approval.")
        if row.user_approved_at is not None:
            raise ApprovalRequiredError("This payment has already been approved.")

        expires = row.user_approval_expires_at
        if expires is not None:
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires:
                raise ApprovalExpiredError()

        method = self._verify_step_up(user_id, payload)

        try:
            row = self._repo.approve_user_confirmation(
                transaction_id,
                approval_method=method,
            )
        except TransactionStateError as exc:
            message = str(exc)
            if "expired" in message.lower():
                raise ApprovalExpiredError() from exc
            raise ApprovalRequiredError(message) from exc

        self._approval_repo.record_event(
            transaction_id=transaction_id,
            event_type="approved",
            actor_user_id=user_id,
            verification_method=method,
        )
        self._repo._db.commit()
        return row

    def list_approval_events(self, transaction_id: int, *, user_id: int) -> list:
        row = self._repo.get_by_id(transaction_id)
        if row is None:
            raise TransactionNotFoundError()
        if not self._user_participates(row, user_id):
            raise ForbiddenError()
        return self._approval_repo.list_for_transaction(transaction_id)

    def _requires_user_approval(self, payload: TransactionCreate, type_name: str) -> bool:
        if payload.requires_approval:
            return True
        settings = get_settings()
        configured_types = {
            name.strip().lower()
            for name in settings.tx_user_approval_type_names.split(",")
            if name.strip()
        }
        if type_name.lower() in configured_types:
            return True
        if payload.amount >= settings.tx_user_approval_above_amount:
            return True
        return False

    @staticmethod
    def _recipient_name(recipient_card) -> str | None:
        """Best-effort display name for the recipient, used for keyword matching."""
        if recipient_card is None:
            return None
        user = getattr(recipient_card, "user", None)
        if user is not None:
            parts = [getattr(user, "first_name", None), getattr(user, "last_name", None)]
            name = " ".join(p for p in parts if p).strip()
            if name:
                return name
        return getattr(recipient_card, "cardholder_name", None)

    def _resolve_auto_category(
        self,
        *,
        user_id: int,
        note: str | None,
        recipient_name: str | None,
    ) -> int | None:
        """Return the category_id of the first matching keyword rule, or None.

        Deterministic substring match (lowercased) on the note / recipient name.
        Rules are pre-ordered by precedence (user rules before global, then
        priority asc), so the first match wins. No ML, no MCC.
        """
        note_text = (note or "").lower()
        recipient_text = (recipient_name or "").lower()
        if not note_text and not recipient_text:
            return None

        for rule in self._category_rule_repo.list_applicable(user_id=user_id):
            haystack = recipient_text if rule.match_field == "recipient_name" else note_text
            if rule.keyword and rule.keyword.lower() in haystack:
                return rule.category_id
        return None

    def _verify_step_up(self, user_id: int, payload: TransactionApproveRequest) -> str:
        if self._auth_repo is None:
            raise ApprovalRequiredError("Step-up verification is unavailable.")

        user = self._auth_repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ForbiddenError()

        settings = get_settings()
        if user.totp_enabled:
            if not payload.totp_code:
                raise ApprovalRequiredError("Authenticator code is required.")
            if not user.totp_secret:
                raise ApprovalRequiredError("Two-factor authentication is not configured.")
            plain_secret = decrypt_secret(user.totp_secret, settings.totp_encryption_key)
            if not verify_totp_code(plain_secret, payload.totp_code):
                raise ApprovalRequiredError("Invalid authentication code.")
            return "totp"

        if not payload.password:
            raise ApprovalRequiredError("Password is required to confirm this payment.")
        if not bcrypt.checkpw(
            payload.password.encode("utf-8"),
            user.password_hash.encode("utf-8"),
        ):
            raise ApprovalRequiredError("Incorrect password.")
        return "password"

    def _user_is_sender(self, row: Transaction, user_id: int) -> bool:
        if row.sender_card_id is None:
            return False
        return self._repo.card_owner_id(row.sender_card_id) == user_id

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

        # Validate a category change (set or clear). category_id is metadata only:
        # it is applied via the plain update below and never touches status,
        # balances, or the settle flow. A null clears it ("Uncategorised").
        if "category_id" in changes:
            category_id = changes["category_id"]
            if category_id is not None and not self._repo.transaction_category_exists(
                category_id
            ):
                raise TransactionCategoryNotFoundError()

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
        cancelled_id = self._repo.get_status_id_by_name("cancelled")

        if (
            pending_id is None
            or completed_id is None
            or failed_id is None
            or cancelled_id is None
        ):
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
            if new_status_id == cancelled_id:
                # User/owner-initiated cancel of a pending transaction. Releases the
                # sender's held funds (same reversal as fail) but stamps the distinct
                # 'cancelled' status so it doesn't read as a processor failure.
                reason = "STAFF_CANCELLED" if processed_by == "staff" else "USER_CANCELLED"
                updated = self._repo.cancel(
                    row.transaction_id,
                    reason_code=reason,
                    processed_by=processed_by,
                )
                if row.requires_user_approval and row.user_approved_at is None:
                    actor_id = None
                    if processed_by == "user":
                        actor_id = self._repo.card_owner_id(row.sender_card_id)
                    self._approval_repo.record_event(
                        transaction_id=row.transaction_id,
                        event_type="cancelled",
                        actor_user_id=actor_id,
                        detail=reason,
                    )
                    self._repo._db.commit()
                return updated
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
