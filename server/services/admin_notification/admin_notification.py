import logging

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from models.card_freeze_request_detail import CardFreezeRequestDetail
from models.refund_request_detail import RefundRequestDetail
from models.request import Request
from models.transaction import Transaction
from repositories.admin_notification.admin_notification import AdminNotificationRepository
from services.email import admin_templates
from services.email.mailer import EmailMailer
from settings import get_settings

logger = logging.getLogger(__name__)

EVENT_REFUND_REQUESTED = "refund_requested"
EVENT_CARD_FREEZE_REQUESTED = "card_freeze_requested"
EVENT_CARD_UNFREEZE_REQUESTED = "card_unfreeze_requested"
EVENT_TRANSACTION_FLAGGED = "transaction_flagged"


class AdminNotificationService:
    """Emails opted-in staff when users submit requests or a tx is flagged.

    Fail-open by design: a mail/DB hiccup here must never block the user's
    action that triggered it. Every public method swallows its own errors.
    """

    def __init__(self, db: Session) -> None:
        self._db = db
        self._settings = get_settings()
        self._mailer = EmailMailer(self._settings)
        self._repo = AdminNotificationRepository(db)

    def notify_refund_requested(self, request_id: int) -> None:
        try:
            request = self._load_refund_request(request_id)
            if request is None:
                return
            requester = request.requester
            amount = None
            transaction_id = None
            if request.refund_detail is not None:
                transaction_id = request.refund_detail.transaction_id
                if request.refund_detail.transaction is not None:
                    amount = request.refund_detail.transaction.amount
            subject, body = admin_templates.refund_requested(
                requester_name=_full_name(requester),
                requester_user_id=request.requester_user_id,
                request_id=request_id,
                transaction_id=transaction_id,
                amount=amount,
                note=request.note,
            )
            self._fan_out(
                event_type=EVENT_REFUND_REQUESTED,
                reference_id=str(request_id),
                subject=subject,
                body=body,
            )
        except Exception:
            logger.exception("Admin refund-request notification failed (request %s)", request_id)

    def notify_card_action_requested(self, request_id: int, *, action: str) -> None:
        try:
            request = self._load_freeze_request(request_id)
            if request is None:
                return
            card_last_four = None
            detail = getattr(request, "card_freeze_detail", None)
            if detail is not None and detail.card is not None:
                card_last_four = detail.card.last_four
            subject, body = admin_templates.card_action_requested(
                action=action,
                requester_name=_full_name(request.requester),
                requester_user_id=request.requester_user_id,
                request_id=request_id,
                card_last_four=card_last_four,
                note=request.note,
            )
            event_type = (
                EVENT_CARD_FREEZE_REQUESTED
                if action == "card_freeze"
                else EVENT_CARD_UNFREEZE_REQUESTED
            )
            self._fan_out(
                event_type=event_type,
                reference_id=str(request_id),
                subject=subject,
                body=body,
            )
        except Exception:
            logger.exception("Admin card-action notification failed (request %s)", request_id)

    def notify_transaction_flagged(self, transaction_id: int, *, reason: str) -> None:
        try:
            tx = self._db.get(Transaction, transaction_id)
            if tx is None:
                return
            subject, body = admin_templates.transaction_flagged(
                transaction_id=transaction_id,
                amount=tx.amount,
                reason=reason,
            )
            self._fan_out(
                event_type=EVENT_TRANSACTION_FLAGGED,
                reference_id=str(transaction_id),
                subject=subject,
                body=body,
            )
        except Exception:
            logger.exception(
                "Admin transaction-flagged notification failed (tx %s)", transaction_id
            )

    def _fan_out(self, *, event_type: str, reference_id: str, subject: str, body: str) -> None:
        recipients = self._repo.list_opted_in_recipients()
        for recipient in recipients:
            email = (recipient.email or "").strip()
            if not email:
                continue
            # Dedup + audit in one insert; if it was already sent, skip.
            if not self._repo.try_record_send(
                recipient_user_id=recipient.user_id,
                recipient_email=email,
                event_type=event_type,
                reference_id=reference_id,
            ):
                continue
            try:
                self._mailer.send(to=email, subject=subject, body=body)
            except Exception:
                logger.exception("Failed to send admin email [%s] to %s", subject, email)

    def _load_refund_request(self, request_id: int) -> Request | None:
        stmt = (
            select(Request)
            .options(
                joinedload(Request.requester),
                joinedload(Request.refund_detail).joinedload(RefundRequestDetail.transaction),
            )
            .where(Request.request_id == request_id)
        )
        return self._db.scalars(stmt).unique().first()

    def _load_freeze_request(self, request_id: int) -> Request | None:
        stmt = (
            select(Request)
            .options(
                joinedload(Request.requester),
                joinedload(Request.card_freeze_detail).joinedload(CardFreezeRequestDetail.card),
            )
            .where(Request.request_id == request_id)
        )
        return self._db.scalars(stmt).unique().first()


def _full_name(user) -> str | None:
    if user is None:
        return None
    name = f"{user.first_name} {user.last_name}".strip()
    return name or None
