from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from models.transaction import Transaction
from repositories.payment_approval.payment_approval import PaymentApprovalRepository
from repositories.transaction.transaction import TransactionRepository, TransactionStateError
from settings import Settings, get_settings

Action = Literal["allow", "deny", "skip"]
ProcessResult = Literal["allowed", "denied", "skipped"]

# Deny / allow reason codes persisted on the transaction row.
RECIPIENT_CARD_MISSING = "RECIPIENT_CARD_MISSING"
SENDER_CARD_MISSING = "SENDER_CARD_MISSING"
RECIPIENT_USER_INACTIVE = "RECIPIENT_USER_INACTIVE"
SENDER_USER_INACTIVE = "SENDER_USER_INACTIVE"
RECIPIENT_CARD_INACTIVE = "RECIPIENT_CARD_INACTIVE"
SENDER_CARD_INACTIVE = "SENDER_CARD_INACTIVE"
RECIPIENT_CARD_EXPIRED = "RECIPIENT_CARD_EXPIRED"
SENDER_CARD_EXPIRED = "SENDER_CARD_EXPIRED"
SELF_TRANSFER = "SELF_TRANSFER"
AUTO_ALLOW = "AUTO_ALLOW"
PENDING_TIMEOUT_ALLOW = "PENDING_TIMEOUT_ALLOW"
PENDING_TIMEOUT_DENY = "PENDING_TIMEOUT_DENY"
APPROVAL_TIMEOUT = "APPROVAL_TIMEOUT"
AWAITING_USER_APPROVAL = "AWAITING_USER_APPROVAL"
MANUAL_REVIEW = "MANUAL_REVIEW"


@dataclass(frozen=True)
class ProcessorDecision:
    action: Action
    reason_code: str | None = None


class TransactionProcessorService:
    def __init__(
        self,
        repo: TransactionRepository,
        settings: Settings | None = None,
        approval_repo: PaymentApprovalRepository | None = None,
    ) -> None:
        self._repo = repo
        self._settings = settings or get_settings()
        self._approval_repo = approval_repo or PaymentApprovalRepository(repo._db)

    def process_batch(self) -> dict[str, int]:
        rows = self._repo.list_pending_for_update(
            limit=self._settings.tx_processor_batch_size
        )
        stats = {
            "processed": 0,
            "allowed": 0,
            "denied": 0,
            "skipped": 0,
            "errors": 0,
        }
        for tx in rows:
            try:
                outcome = self.process_one(tx)
                stats["processed"] += 1
                stats[outcome] += 1
            except TransactionStateError:
                stats["errors"] += 1
        return stats

    def process_one(self, tx: Transaction) -> ProcessResult:
        decision = evaluate_transaction(tx, self._settings)
        if decision.action == "skip":
            if decision.reason_code == MANUAL_REVIEW:
                self._notify_admins_flagged(tx.transaction_id)
            return "skipped"
        if decision.action == "allow":
            self._repo.complete(tx.transaction_id, processed_by="system")
            from services.email.transaction_notifier import TransactionEmailNotifier

            TransactionEmailNotifier(self._repo._db).notify_transaction_completed(
                tx.transaction_id
            )
            return "allowed"
        self._repo.fail(
            tx.transaction_id,
            reason_code=decision.reason_code or "DENIED",
            processed_by="system",
        )
        if decision.reason_code == APPROVAL_TIMEOUT:
            self._approval_repo.record_event(
                transaction_id=tx.transaction_id,
                event_type="timed_out",
                verification_method="system",
                detail=APPROVAL_TIMEOUT,
            )
            self._repo._db.commit()
        return "denied"

    def _notify_admins_flagged(self, transaction_id: int) -> None:
        from services.admin_notification.admin_notification import AdminNotificationService

        AdminNotificationService(self._repo._db).notify_transaction_flagged(
            transaction_id, reason="Amount exceeds the manual-review threshold."
        )


def evaluate_transaction(tx: Transaction, settings: Settings) -> ProcessorDecision:
    """Pure rule evaluation — no balance or status changes."""
    recipient = tx.recipient_card
    if recipient is None or recipient.deleted_at is not None:
        return ProcessorDecision("deny", RECIPIENT_CARD_MISSING)
    if _is_card_expired(recipient):
        return ProcessorDecision("deny", RECIPIENT_CARD_EXPIRED)
    if not _is_active_card(recipient):
        return ProcessorDecision("deny", RECIPIENT_CARD_INACTIVE)
    if not _is_active_user(recipient.user):
        return ProcessorDecision("deny", RECIPIENT_USER_INACTIVE)

    sender = tx.sender_card
    if tx.sender_card_id is not None:
        if sender is None or sender.deleted_at is not None:
            return ProcessorDecision("deny", SENDER_CARD_MISSING)
        if _is_card_expired(sender):
            return ProcessorDecision("deny", SENDER_CARD_EXPIRED)
        if not _is_active_card(sender):
            return ProcessorDecision("deny", SENDER_CARD_INACTIVE)
        if not _is_active_user(sender.user):
            return ProcessorDecision("deny", SENDER_USER_INACTIVE)
        if sender.user_id == recipient.user_id:
            return ProcessorDecision("deny", SELF_TRANSFER)

    if tx.amount > settings.tx_manual_review_above_amount:
        return ProcessorDecision("skip", MANUAL_REVIEW)

    if getattr(tx, "requires_user_approval", False) and tx.user_approved_at is None:
        expires = getattr(tx, "user_approval_expires_at", None)
        if expires is not None:
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires:
                return ProcessorDecision("deny", APPROVAL_TIMEOUT)
        return ProcessorDecision("skip", AWAITING_USER_APPROVAL)

    if _is_pending_timeout(tx, settings):
        if settings.tx_pending_timeout_action == "allow":
            return ProcessorDecision("allow", PENDING_TIMEOUT_ALLOW)
        return ProcessorDecision("deny", PENDING_TIMEOUT_DENY)

    return ProcessorDecision("allow", AUTO_ALLOW)


def _is_card_expired(card) -> bool:
    return card.expires_at < _today_utc()


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _is_active_card(card) -> bool:
    return card.status is not None and card.status.status_name == "active"


def _is_active_user(user) -> bool:
    if user is None or user.deleted_at is not None:
        return False
    return user.status is not None and user.status.status_name == "active"


def _is_pending_timeout(tx: Transaction, settings: Settings) -> bool:
    created = tx.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - created
    return age > timedelta(minutes=settings.tx_pending_max_age_minutes)
