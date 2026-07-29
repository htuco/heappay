from datetime import date, datetime, timedelta, timezone
import base64
import json
from decimal import Decimal

import bcrypt
from sqlalchemy.exc import IntegrityError
from webauthn import (
    generate_authentication_options,
    options_to_json,
    verify_authentication_response,
)
from webauthn.helpers.exceptions import WebAuthnException
from webauthn.helpers.structs import PublicKeyCredentialDescriptor, UserVerificationRequirement

from models.transaction import Transaction
from repositories.family.family_link import FamilyLinkRepository
from repositories.family.spending_limit_rule import SpendingLimitRuleRepository
from repositories.payment_approval.payment_approval import PaymentApprovalRepository
from repositories.transaction.category_rule import CategoryRuleRepository
from repositories.transaction.transaction import TransactionRepository, TransactionStateError
from repositories.user.auth import UserAuthRepository
from schemas.transaction import (
    BiometricApprovalAssertion,
    BiometricApprovalOptionsResponse,
    TransactionApproveRequest,
    TransactionCreate,
    TransactionPatch,
)
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


class SpendingLimitExceededError(Exception):
    """A dependent's transaction would breach a guardian-set spending cap
    that has no approval escape hatch configured."""


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


class TransactionService:
    DEFAULT_STATUS = "pending"
    FROZEN_CARD_STATUS = "frozen"

    def __init__(
        self,
        repo: TransactionRepository,
        approval_repo: PaymentApprovalRepository | None = None,
        auth_repo: UserAuthRepository | None = None,
        category_rule_repo: "CategoryRuleRepository | None" = None,
        family_link_repo: "FamilyLinkRepository | None" = None,
        spending_limit_rule_repo: "SpendingLimitRuleRepository | None" = None,
    ) -> None:
        self._repo = repo
        self._approval_repo = approval_repo or PaymentApprovalRepository(repo._db)
        self._auth_repo = auth_repo
        self._category_rule_repo = category_rule_repo or CategoryRuleRepository(repo._db)
        self._family_link_repo = family_link_repo or FamilyLinkRepository(repo._db)
        self._spending_limit_rule_repo = (
            spending_limit_rule_repo or SpendingLimitRuleRepository(repo._db)
        )

    def list_for_user(
        self,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        status_id: int | None = None,
        transaction_type_id: int | None = None,
        category_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
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
            from_date=from_date,
            to_date=to_date,
            sort=sort,
        )
        total = self._repo.count_for_user(
            user_id=user_id,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
            from_date=from_date,
            to_date=to_date,
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
        from_date: date | None = None,
        to_date: date | None = None,
        user_role_name: str | None = None,
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
            from_date=from_date,
            to_date=to_date,
            user_role_name=user_role_name,
            sort=sort,
        )
        total = self._repo.count_all(
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
            from_date=from_date,
            to_date=to_date,
            user_role_name=user_role_name,
        )
        return items, total

    def get_platform_stats(
        self,
        *,
        months: int = 6,
        status_id: int | None = None,
        transaction_type_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        user_role_name: str | None = None,
    ) -> dict:
        if status_id is not None and not self._repo.transaction_status_exists(status_id):
            raise TransactionStatusNotFoundError()
        if transaction_type_id is not None and not self._repo.transaction_type_exists(
            transaction_type_id
        ):
            raise TransactionTypeNotFoundError()
        return self._repo.get_platform_stats(
            months=months,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            from_date=from_date,
            to_date=to_date,
            user_role_name=user_role_name,
        )

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

        self._verify_transaction_create_confirmation(user_id, payload)

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

        # A dependent's own transaction is additionally checked against any
        # spending-limit rules their guardian has set. approver_user_id
        # defaults to the payer so approve()'s ownership check has one
        # uniform column to read; it's only redirected to the guardian when
        # a rule requires it.
        approver_user_id = user_id
        family_link = None
        if sender_card is not None:
            family_link = self._family_link_repo.get_accepted_for_dependent(sender_card.user_id)
        if family_link is not None:
            blocked, limit_requires_approval = self._evaluate_spending_limits(
                dependent_user_id=sender_card.user_id,
                category_id=category_id,
                amount=payload.amount,
            )
            if blocked:
                raise SpendingLimitExceededError()
            if limit_requires_approval:
                requires_approval = True
                approver_user_id = family_link.guardian_user_id

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
                approver_user_id=approver_user_id,
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

    def begin_biometric_transaction_verification(
        self,
        *,
        user_id: int,
    ) -> BiometricApprovalOptionsResponse:
        if self._auth_repo is None:
            raise ApprovalRequiredError("Step-up verification is unavailable.")

        credentials = self._auth_repo.list_biometric_credentials(user_id)
        if not credentials:
            raise ApprovalRequiredError("Biometric authentication is not enabled.")

        options = generate_authentication_options(
            rp_id=get_settings().webauthn_rp_id,
            allow_credentials=[
                PublicKeyCredentialDescriptor(id=_base64url_decode(credential.credential_id))
                for credential in credentials
            ],
            user_verification=UserVerificationRequirement.REQUIRED,
        )
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=get_settings().webauthn_registration_challenge_expire_minutes,
        )
        challenge = self._auth_repo.create_biometric_authentication_challenge(
            user_id=user_id,
            transaction_id=None,
            challenge=_base64url_encode(options.challenge),
            expires_at=expires_at,
        )

        return BiometricApprovalOptionsResponse(
            challenge_id=challenge.challenge_id,
            publicKey=json.loads(options_to_json(options)),
        )

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
        if not self._user_is_approver(row, user_id):
            raise ForbiddenError()
        self._ensure_approval_pending(row)

        method = self._verify_step_up(transaction_id, user_id, payload)

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

    @staticmethod
    def _ensure_approval_pending(row: Transaction) -> None:
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

    def begin_biometric_approval(
        self,
        transaction_id: int,
        *,
        user_id: int,
    ) -> BiometricApprovalOptionsResponse:
        if self._auth_repo is None:
            raise ApprovalRequiredError("Step-up verification is unavailable.")

        row = self._repo.get_by_id(transaction_id)
        if row is None:
            raise TransactionNotFoundError()
        if not self._user_is_approver(row, user_id):
            raise ForbiddenError()
        self._ensure_approval_pending(row)

        credentials = self._auth_repo.list_biometric_credentials(user_id)
        if not credentials:
            raise ApprovalRequiredError("Biometric authentication is not enabled.")

        options = generate_authentication_options(
            rp_id=get_settings().webauthn_rp_id,
            allow_credentials=[
                PublicKeyCredentialDescriptor(id=_base64url_decode(credential.credential_id))
                for credential in credentials
            ],
            user_verification=UserVerificationRequirement.REQUIRED,
        )
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=get_settings().webauthn_registration_challenge_expire_minutes,
        )
        challenge = self._auth_repo.create_biometric_authentication_challenge(
            user_id=user_id,
            transaction_id=transaction_id,
            challenge=_base64url_encode(options.challenge),
            expires_at=expires_at,
        )

        return BiometricApprovalOptionsResponse(
            challenge_id=challenge.challenge_id,
            publicKey=json.loads(options_to_json(options)),
        )

    def list_pending_approvals_for_approver(self, approver_user_id: int) -> list[Transaction]:
        """An approver's view of transactions awaiting their sign-off --
        their own large/flagged payments plus any dependent's transactions
        redirected to them by a spending-limit rule."""
        return self._repo.list_pending_approvals_for_approver(approver_user_id)

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

    def _user_requires_payment_confirmation(self, user, amount: Decimal) -> bool:
        if not getattr(user, "payment_confirm_enabled", True):
            return False
        threshold = getattr(user, "payment_confirm_above_amount", Decimal("0"))
        if threshold is None:
            threshold = Decimal("0")
        return amount >= threshold

    def _verify_transaction_create_confirmation(
        self,
        user_id: int,
        payload: TransactionCreate,
    ) -> None:
        if self._auth_repo is None:
            return

        if payload.biometric:
            self._verify_biometric_approval(None, user_id, payload.biometric)
            return

        if payload.app_pin:
            self._verify_app_pin(user_id, payload.app_pin)
            return

        user = self._auth_repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ForbiddenError()

        if payload.totp_code:
            self._verify_totp_for_user(user, payload.totp_code)
            return

        if payload.password:
            self._verify_password_for_user(user, payload.password)
            return

        credentials = self._auth_repo.list_biometric_credentials(user_id)
        if credentials:
            raise ApprovalRequiredError(
                "Biometric verification or app PIN is required to send money."
            )
        if getattr(user, "app_pin_hash", None):
            raise ApprovalRequiredError("App PIN is required to send money.")
        if user.totp_enabled:
            raise ApprovalRequiredError("Authenticator code is required to send money.")
        if self._user_requires_payment_confirmation(user, payload.amount):
            raise ApprovalRequiredError("Password is required to confirm this payment.")

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

    def _evaluate_spending_limits(
        self, *, dependent_user_id: int, category_id: int | None, amount: Decimal
    ) -> tuple[bool, bool]:
        """Evaluate every applicable SpendingLimitRule for this dependent's
        transaction. Returns (blocked, requires_approval).

        Each rule is an independent constraint: `requires_approval_always` or
        `requires_approval_above` always redirects into the approval
        workflow when triggered. A breached period `max_amount` cap on a
        rule that has *no* approval escape configured (neither of the above
        set) is an outright block -- same posture as
        `InsufficientBalanceError`. A breach on a rule that does have an
        escape configured routes to approval instead of blocking. A block
        from any rule wins over an approval requirement from another.
        """
        now = datetime.now(timezone.utc)
        requires_approval = False
        for rule in self._spending_limit_rule_repo.list_applicable(
            dependent_user_id=dependent_user_id, category_id=category_id
        ):
            has_escape = rule.requires_approval_always or rule.requires_approval_above is not None
            if rule.requires_approval_always:
                requires_approval = True
            if rule.requires_approval_above is not None and amount >= rule.requires_approval_above:
                requires_approval = True

            prior_spend = self._spending_limit_rule_repo.sum_period_spend(
                dependent_user_id=dependent_user_id,
                category_id=rule.category_id,
                period=rule.period,
                now=now,
            )
            if prior_spend + amount > rule.max_amount:
                if has_escape:
                    requires_approval = True
                else:
                    return True, requires_approval
        return False, requires_approval

    def _verify_step_up(
        self,
        transaction_id: int,
        user_id: int,
        payload: TransactionApproveRequest,
    ) -> str:
        if self._auth_repo is None:
            raise ApprovalRequiredError("Step-up verification is unavailable.")

        user = self._auth_repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ForbiddenError()

        if payload.biometric:
            return self._verify_biometric_approval(transaction_id, user_id, payload.biometric)

        if payload.app_pin:
            return self._verify_app_pin(user_id, payload.app_pin)

        if payload.totp_code:
            self._verify_totp_for_user(user, payload.totp_code)
            return "totp"

        if payload.password:
            self._verify_password_for_user(user, payload.password)
            return "password"

        if user.totp_enabled:
            raise ApprovalRequiredError("Authenticator code is required.")
        raise ApprovalRequiredError("Password is required to confirm this payment.")

    def _verify_totp_for_user(self, user, totp_code: str) -> None:
        settings = get_settings()
        if not user.totp_enabled:
            raise ApprovalRequiredError("Two-factor authentication is not enabled.")
        if not user.totp_secret:
            raise ApprovalRequiredError("Two-factor authentication is not configured.")
        plain_secret = decrypt_secret(user.totp_secret, settings.totp_encryption_key)
        if not verify_totp_code(plain_secret, totp_code):
            raise ApprovalRequiredError("Invalid authentication code.")

    def _verify_password_for_user(self, user, password: str) -> None:
        if not bcrypt.checkpw(
            password.encode("utf-8"),
            user.password_hash.encode("utf-8"),
        ):
            raise ApprovalRequiredError("Incorrect password.")

    def _verify_app_pin(self, user_id: int, pin: str) -> str:
        if self._auth_repo is None:
            raise ApprovalRequiredError("Step-up verification is unavailable.")

        user = self._auth_repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ForbiddenError()
        if not getattr(user, "app_pin_hash", None):
            raise ApprovalRequiredError("Set an app PIN in Settings before sending money.")

        locked_until = getattr(user, "app_pin_locked_until", None)
        if self._is_pin_locked(locked_until):
            raise ApprovalRequiredError("App PIN is locked. Try again later.")

        if bcrypt.checkpw(pin.encode("utf-8"), user.app_pin_hash.encode("utf-8")):
            self._auth_repo.reset_app_pin_failures(user_id)
            return "app_pin"

        settings = get_settings()
        failed_attempts = (getattr(user, "app_pin_failed_attempts", 0) or 0) + 1
        new_locked_until = None
        if failed_attempts >= settings.app_pin_max_failed_attempts:
            new_locked_until = datetime.now(timezone.utc) + timedelta(
                minutes=settings.app_pin_lockout_minutes,
            )
        self._auth_repo.record_app_pin_failure(
            user_id,
            failed_attempts=failed_attempts,
            locked_until=new_locked_until,
        )
        if new_locked_until is not None:
            raise ApprovalRequiredError("App PIN is locked. Try again later.")
        raise ApprovalRequiredError("Incorrect app PIN.")

    def _verify_biometric_approval(
        self,
        transaction_id: int | None,
        user_id: int,
        payload: BiometricApprovalAssertion,
    ) -> str:
        credential_id = payload.credential.get("rawId") or payload.credential.get("id")
        if not isinstance(credential_id, str):
            raise ApprovalRequiredError("Biometric verification failed.")

        credential = self._auth_repo.get_biometric_credential(user_id, credential_id)
        if credential is None:
            raise ApprovalRequiredError("Biometric credential is not enrolled.")

        challenge = self._auth_repo.get_biometric_authentication_challenge(
            user_id=user_id,
            transaction_id=transaction_id,
            challenge_id=payload.challenge_id,
        )
        if (
            challenge is None
            or challenge.used_at is not None
            or self._is_expired(challenge.expires_at)
        ):
            raise ApprovalRequiredError("Biometric verification expired. Try again.")

        settings = get_settings()
        origins = settings.webauthn_origin_list or settings.cors_origin_list
        try:
            verified = verify_authentication_response(
                credential=payload.credential,
                expected_challenge=_base64url_decode(challenge.challenge),
                expected_rp_id=settings.webauthn_rp_id,
                expected_origin=origins,
                credential_public_key=credential.public_key,
                credential_current_sign_count=credential.sign_count,
                require_user_verification=True,
            )
        except WebAuthnException as exc:
            raise ApprovalRequiredError("Biometric verification failed.") from exc

        self._auth_repo.mark_biometric_authentication_challenge_used(challenge.challenge_id)
        self._auth_repo.update_biometric_credential_usage(
            credential_row_id=credential.credential_row_id,
            sign_count=verified.new_sign_count,
        )
        return "biometric"

    @staticmethod
    def _is_expired(value: datetime) -> bool:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value <= datetime.now(timezone.utc)

    @staticmethod
    def _is_pin_locked(locked_until: datetime | None) -> bool:
        if locked_until is None:
            return False
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        return locked_until > datetime.now(timezone.utc)

    def _user_is_sender(self, row: Transaction, user_id: int) -> bool:
        if row.sender_card_id is None:
            return False
        return self._repo.card_owner_id(row.sender_card_id) == user_id

    def _user_is_approver(self, row: Transaction, user_id: int) -> bool:
        """Who may approve/decline this transaction's pending approval.

        `approver_user_id` is set on every transaction created going
        forward (defaulting to the payer, redirected to a guardian for a
        dependent under a spending-limit rule) -- see `create()`. Rows that
        predate that column stay `NULL` and fall back to the original
        sender-owner check.
        """
        if row.approver_user_id is not None:
            return row.approver_user_id == user_id
        return self._user_is_sender(row, user_id)

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
                completed = self._repo.complete(
                    row.transaction_id, processed_by=processed_by
                )
                from services.email.transaction_notifier import TransactionEmailNotifier

                TransactionEmailNotifier(self._repo._db).notify_transaction_completed(
                    row.transaction_id
                )
                return completed
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
