import logging
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from models.card import Card
from models.refund_request_detail import RefundRequestDetail
from models.request import Request
from models.transaction import Transaction
from models.user import User
from repositories.email.email_notification_log import EmailNotificationLogRepository
from repositories.transaction.transaction import TransactionRepository
from services.email import templates
from services.email.mailer import EmailMailer
from settings import get_settings
from utils.user_notification_email import notification_email_for_user

logger = logging.getLogger(__name__)

EVENT_PAYMENT_SENT = "payment_sent"
EVENT_PAYMENT_RECEIVED = "payment_received"
EVENT_TOPUP = "topup"
EVENT_OUTFLOW = "outflow"
EVENT_REFUND_APPROVED = "refund_approved"
EVENT_REFUND_DECLINED = "refund_declined"


class TransactionEmailNotifier:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._settings = get_settings()
        self._mailer = EmailMailer(self._settings)
        self._dedup = EmailNotificationLogRepository(db)
        self._tx_repo = TransactionRepository(db)

    def notify_transaction_completed(self, transaction_id: int) -> None:
        tx = self._load_transaction(transaction_id)
        if tx is None:
            return

        type_name = tx.transaction_type.name if tx.transaction_type else ""
        if type_name == "deposit":
            self._notify_topup(tx)
            return

        if tx.sender_card_id is not None and tx.sender_card is not None:
            self._notify_payment_sent(tx)
            self._notify_outflow(tx)
        if tx.recipient_card is not None:
            self._notify_payment_received(tx)

    def notify_refund_approved(self, request_id: int) -> None:
        request = self._load_refund_request(request_id)
        if request is None or request.requester is None:
            return
        user = request.requester
        if not user.email_refund_status_enabled:
            return

        ref = str(request_id)
        if not self._dedup.try_record_send(
            user_id=user.user_id, event_type=EVENT_REFUND_APPROVED, reference_id=ref
        ):
            return

        amount = None
        tx_id = None
        if request.refund_detail is not None:
            tx_id = request.refund_detail.transaction_id
            if request.refund_detail.transaction is not None:
                amount = request.refund_detail.transaction.amount

        subject, body = templates.refund_approved(
            first_name=user.first_name,
            amount=amount,
            request_id=request_id,
            transaction_id=tx_id,
        )
        self._send(notification_email_for_user(user), subject, body)

    def notify_refund_declined(self, request_id: int) -> None:
        request = self._load_refund_request(request_id)
        if request is None or request.requester is None:
            return
        user = request.requester
        if not user.email_refund_status_enabled:
            return

        ref = str(request_id)
        if not self._dedup.try_record_send(
            user_id=user.user_id, event_type=EVENT_REFUND_DECLINED, reference_id=ref
        ):
            return

        tx_id = request.refund_detail.transaction_id if request.refund_detail else None
        subject, body = templates.refund_declined(
            first_name=user.first_name,
            request_id=request_id,
            transaction_id=tx_id,
        )
        self._send(notification_email_for_user(user), subject, body)

    def _notify_topup(self, tx: Transaction) -> None:
        user = tx.recipient_card.user if tx.recipient_card else None
        if user is None or not user.email_topup_enabled:
            return
        self._send_transaction_email(
            user=user,
            event_type=EVENT_TOPUP,
            reference_id=str(tx.transaction_id),
            subject_body=templates.topup_completed(
                first_name=user.first_name,
                amount=tx.amount,
                transaction_id=tx.transaction_id,
            ),
        )

    def _notify_payment_sent(self, tx: Transaction) -> None:
        user = tx.sender_card.user if tx.sender_card else None
        if user is None or not user.email_payment_sent_enabled:
            return
        self._send_transaction_email(
            user=user,
            event_type=EVENT_PAYMENT_SENT,
            reference_id=str(tx.transaction_id),
            subject_body=templates.payment_sent(
                first_name=user.first_name,
                amount=tx.amount,
                transaction_id=tx.transaction_id,
            ),
        )

    def _notify_outflow(self, tx: Transaction) -> None:
        user = tx.sender_card.user if tx.sender_card else None
        if user is None or not user.email_outflow_enabled:
            return
        # Self-transfers (sender and recipient are the same user) don't change the
        # user's net balance, so they are not an outflow.
        recipient_user = tx.recipient_card.user if tx.recipient_card else None
        if recipient_user is not None and recipient_user.user_id == user.user_id:
            return
        balance = self._current_balance_for_user(user.user_id)
        self._send_transaction_email(
            user=user,
            event_type=EVENT_OUTFLOW,
            reference_id=str(tx.transaction_id),
            subject_body=templates.outflow_alert(
                first_name=user.first_name,
                amount=tx.amount,
                balance=balance,
                transaction_id=tx.transaction_id,
            ),
        )

    def _notify_payment_received(self, tx: Transaction) -> None:
        user = tx.recipient_card.user if tx.recipient_card else None
        if user is None or not user.email_payment_received_enabled:
            return
        # Same user as sender — one combined in-app toast; email both only if prefs allow
        # but use distinct dedup keys (sent vs received) per ticket.
        self._send_transaction_email(
            user=user,
            event_type=EVENT_PAYMENT_RECEIVED,
            reference_id=str(tx.transaction_id),
            subject_body=templates.payment_received(
                first_name=user.first_name,
                amount=tx.amount,
                transaction_id=tx.transaction_id,
            ),
        )

    def _send_transaction_email(
        self,
        *,
        user: User,
        event_type: str,
        reference_id: str,
        subject_body: tuple[str, str],
    ) -> None:
        if not self._dedup.try_record_send(
            user_id=user.user_id, event_type=event_type, reference_id=reference_id
        ):
            return
        subject, body = subject_body
        self._send(notification_email_for_user(user), subject, body)

    def _current_balance_for_user(self, user_id: int) -> Decimal:
        """The user's spendable balance: wallet pool + sum of active card balances.

        Card balances are already net of escrow holds (the debit is applied on
        create), so by the time an outgoing transaction settles this reflects the
        balance after the outflow. Mirrors the client's Total Balance headline.
        """
        wallet = self._db.scalar(
            select(User.wallet_balance).where(User.user_id == user_id)
        ) or Decimal("0")
        cards = self._db.scalar(
            select(func.coalesce(func.sum(Card.balance), 0)).where(
                Card.user_id == user_id, Card.deleted_at.is_(None)
            )
        ) or Decimal("0")
        return Decimal(wallet) + Decimal(cards)

    def _send(self, email: str, subject: str, body: str) -> None:
        try:
            self._mailer.send(to=email, subject=subject, body=body)
        except Exception:
            logger.exception("Failed to send email [%s] to %s", subject, email)

    def _load_transaction(self, transaction_id: int) -> Transaction | None:
        stmt = (
            select(Transaction)
            .options(
                joinedload(Transaction.transaction_type),
                joinedload(Transaction.sender_card).joinedload(Card.user),
                joinedload(Transaction.recipient_card).joinedload(Card.user),
            )
            .where(Transaction.transaction_id == transaction_id)
        )
        return self._db.scalars(stmt).unique().first()

    def _load_refund_request(self, request_id: int) -> Request | None:
        stmt = (
            select(Request)
            .options(
                joinedload(Request.requester),
                joinedload(Request.refund_detail).joinedload(
                    RefundRequestDetail.transaction
                ),
            )
            .where(Request.request_id == request_id)
        )
        return self._db.scalars(stmt).unique().first()
