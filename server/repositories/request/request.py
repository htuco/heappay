from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.card import Card
from models.refund_request_detail import RefundRequestDetail
from models.request import Request
from models.request_status import RequestStatus
from models.request_type import RequestType
from models.transaction import Transaction
from models.transaction_status import TransactionStatus
from models.transaction_type import TransactionType


class RequestRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    # ── lookups ──────────────────────────────────────────────────────────────

    def get_type_id(self, name: str) -> int | None:
        stmt = select(RequestType.request_type_id).where(RequestType.name == name)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_status_id(self, name: str) -> int | None:
        stmt = select(RequestStatus.request_status_id).where(RequestStatus.name == name)
        return self._db.execute(stmt).scalar_one_or_none()

    def status_name_for(self, status_id: int) -> str | None:
        stmt = select(RequestStatus.name).where(RequestStatus.request_status_id == status_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_transaction_status_id(self, name: str) -> int | None:
        stmt = select(TransactionStatus.transaction_status_id).where(
            TransactionStatus.name == name
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def get_by_id(self, request_id: int) -> Request | None:
        stmt = select(Request).where(Request.request_id == request_id)
        return self._db.scalars(stmt).first()

    def get_pending_refund_for_transaction(self, transaction_id: int) -> Request | None:
        """Return the pending refund request for a transaction, if one exists."""
        pending_id = self.get_status_id("pending")
        refund_type_id = self.get_type_id("refund")
        stmt = (
            select(Request)
            .join(RefundRequestDetail, RefundRequestDetail.request_id == Request.request_id)
            .where(
                RefundRequestDetail.transaction_id == transaction_id,
                Request.request_status_id == pending_id,
                Request.request_type_id == refund_type_id,
            )
        )
        return self._db.scalars(stmt).first()

    def get_any_refund_for_transaction(self, transaction_id: int) -> Request | None:
        """Return any refund request for a transaction regardless of status.

        The DB enforces a single refund per transaction
        (``uq_refund_request_per_transaction``), so this is the authoritative
        pre-check that keeps a duplicate insert from surfacing as a 500.
        """
        refund_type_id = self.get_type_id("refund")
        stmt = (
            select(Request)
            .join(RefundRequestDetail, RefundRequestDetail.request_id == Request.request_id)
            .where(
                RefundRequestDetail.transaction_id == transaction_id,
                Request.request_type_id == refund_type_id,
            )
        )
        return self._db.scalars(stmt).first()

    def list_for_user(self, *, user_id: int, limit: int = 50, offset: int = 0) -> list[Request]:
        refund_type_id = self.get_type_id("refund")
        stmt = (
            select(Request)
            .where(
                Request.requester_user_id == user_id,
                Request.request_type_id == refund_type_id,
            )
            .order_by(Request.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).all())

    def count_for_user(self, *, user_id: int) -> int:
        from sqlalchemy import func
        refund_type_id = self.get_type_id("refund")
        stmt = (
            select(func.count())
            .select_from(Request)
            .where(
                Request.requester_user_id == user_id,
                Request.request_type_id == refund_type_id,
            )
        )
        return int(self._db.execute(stmt).scalar_one())

    def list_pending_refunds(self, *, limit: int = 50, offset: int = 0) -> list[Request]:
        pending_id = self.get_status_id("pending")
        refund_type_id = self.get_type_id("refund")
        stmt = (
            select(Request)
            .where(
                Request.request_status_id == pending_id,
                Request.request_type_id == refund_type_id,
            )
            .order_by(Request.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).all())

    def count_pending_refunds(self) -> int:
        from sqlalchemy import func
        pending_id = self.get_status_id("pending")
        refund_type_id = self.get_type_id("refund")
        stmt = (
            select(func.count())
            .select_from(Request)
            .where(
                Request.request_status_id == pending_id,
                Request.request_type_id == refund_type_id,
            )
        )
        return int(self._db.execute(stmt).scalar_one())

    # ── write ─────────────────────────────────────────────────────────────────

    def create_refund_request(
        self,
        *,
        requester_user_id: int,
        transaction_id: int,
        note: str | None,
    ) -> Request:
        refund_type_id = self.get_type_id("refund")
        pending_status_id = self.get_status_id("pending")

        req = Request(
            request_type_id=refund_type_id,
            request_status_id=pending_status_id,
            requester_user_id=requester_user_id,
            note=note,
        )
        self._db.add(req)
        self._db.flush()

        detail = RefundRequestDetail(
            request_id=req.request_id,
            transaction_id=transaction_id,
        )
        self._db.add(detail)
        self._db.commit()
        self._db.refresh(req)
        return req

    def approve_refund(self, request: Request) -> Request:
        """
        Atomically:
        - reverse sender/recipient balances (SELECT FOR UPDATE)
        - set refund transaction → completed (creates it as the original tx reversal)
        - set original transaction → reversed
        - set request → approved
        """
        detail = request.refund_detail
        original_tx: Transaction = (
            self._db.scalars(
                select(Transaction)
                .where(Transaction.transaction_id == detail.transaction_id)
                .with_for_update()
            ).first()
        )

        sender_card: Card | None = None
        if original_tx.sender_card_id is not None:
            sender_card = self._db.scalars(
                select(Card)
                .where(Card.card_id == original_tx.sender_card_id)
                .with_for_update()
            ).first()

        recipient_card: Card = self._db.scalars(
            select(Card)
            .where(Card.card_id == original_tx.recipient_card_id)
            .with_for_update()
        ).first()

        # balance reversal: recipient gives back, sender gets back
        recipient_card.balance = recipient_card.balance - original_tx.amount
        if sender_card is not None:
            sender_card.balance = sender_card.balance + original_tx.amount

        completed_id = self.get_transaction_status_id("completed")
        reversed_id = self.get_transaction_status_id("reversed")
        approved_status_id = self.get_status_id("approved")

        original_tx.status_id = reversed_id

        # create the refund transaction (type=refund, status=completed)
        refund_type_id = self._db.execute(
            select(TransactionType.transaction_type_id).where(TransactionType.name == "refund")
        ).scalar_one()

        refund_tx = Transaction(
            sender_card_id=original_tx.recipient_card_id,
            recipient_card_id=original_tx.sender_card_id,
            transaction_type_id=refund_type_id,
            status_id=completed_id,
            amount=original_tx.amount,
            note=request.note,
        )
        self._db.add(refund_tx)

        request.request_status_id = approved_status_id
        request.resolved_at = datetime.now(timezone.utc)

        self._db.commit()
        self._db.refresh(request)
        return request

    def decline_refund(self, request: Request) -> Request:
        declined_status_id = self.get_status_id("declined")
        request.request_status_id = declined_status_id
        request.resolved_at = datetime.now(timezone.utc)
        self._db.commit()
        self._db.refresh(request)
        return request

    def get_card_for_update(self, card_id: int) -> Card | None:
        return self._db.scalars(
            select(Card).where(Card.card_id == card_id).with_for_update()
        ).first()

    def get_transaction_by_id(self, transaction_id: int) -> Transaction | None:
        return self._db.scalars(
            select(Transaction).where(Transaction.transaction_id == transaction_id)
        ).first()

    def card_owner_id(self, card_id: int) -> int | None:
        stmt = select(Card.user_id).where(
            Card.card_id == card_id, Card.deleted_at.is_(None)
        )
        return self._db.execute(stmt).scalar_one_or_none()
