from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.card import Card
from models.card_freeze_request_detail import CardFreezeRequestDetail
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

    def list_refunds(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        status_id: int | None = None,
    ) -> list[Request]:
        refund_type_id = self.get_type_id("refund")
        stmt = select(Request).where(Request.request_type_id == refund_type_id)
        if status_id is not None:
            stmt = stmt.where(Request.request_status_id == status_id)
        stmt = (
            stmt.order_by(Request.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).all())

    def count_refunds(self, *, status_id: int | None = None) -> int:
        from sqlalchemy import func
        refund_type_id = self.get_type_id("refund")
        stmt = (
            select(func.count())
            .select_from(Request)
            .where(Request.request_type_id == refund_type_id)
        )
        if status_id is not None:
            stmt = stmt.where(Request.request_status_id == status_id)
        return int(self._db.execute(stmt).scalar_one())

    def refund_counts_by_status(self) -> dict[str, int]:
        """Refund-request counts keyed by status name (every seeded status present)."""
        from sqlalchemy import func
        refund_type_id = self.get_type_id("refund")
        stmt = (
            select(
                RequestStatus.name.label("name"),
                func.count(Request.request_id).label("count"),
            )
            .select_from(RequestStatus)
            .outerjoin(
                Request,
                (Request.request_status_id == RequestStatus.request_status_id)
                & (Request.request_type_id == refund_type_id),
            )
            .group_by(RequestStatus.name)
        )
        return {
            row["name"]: int(row["count"])
            for row in self._db.execute(stmt).mappings().all()
        }

    def status_id_exists(self, status_id: int) -> bool:
        from sqlalchemy import func
        stmt = (
            select(func.count())
            .select_from(RequestStatus)
            .where(RequestStatus.request_status_id == status_id)
        )
        return int(self._db.execute(stmt).scalar_one()) > 0

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

    def lock_pending_request(self, request_id: int) -> Request | None:
        """Lock the request row and return it only if still pending.

        Returns ``None`` when the request has already been resolved so the
        caller can reject a double approve/decline. The row lock makes the
        check-then-act atomic against a concurrent approve/decline.
        """
        pending_id = self.get_status_id("pending")
        request = self._db.scalars(
            select(Request).where(Request.request_id == request_id).with_for_update()
        ).first()
        if request is None or request.request_status_id != pending_id:
            return None
        return request

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
            processing_eligible_at=datetime.now(timezone.utc),
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

    # ── card freeze requests ────────────────────────────────────────────────

    def get_pending_freeze_for_card(
        self, card_id: int, *, type_name: str = "card_freeze"
    ) -> Request | None:
        """Return the pending freeze/unfreeze request for a card, if one exists."""
        pending_id = self.get_status_id("pending")
        type_id = self.get_type_id(type_name)
        stmt = (
            select(Request)
            .join(
                CardFreezeRequestDetail,
                CardFreezeRequestDetail.request_id == Request.request_id,
            )
            .where(
                CardFreezeRequestDetail.card_id == card_id,
                Request.request_status_id == pending_id,
                Request.request_type_id == type_id,
            )
        )
        return self._db.scalars(stmt).first()

    def create_freeze_request(
        self,
        *,
        requester_user_id: int,
        card_id: int,
        note: str | None,
        type_name: str = "card_freeze",
    ) -> Request:
        type_id = self.get_type_id(type_name)
        pending_status_id = self.get_status_id("pending")

        req = Request(
            request_type_id=type_id,
            request_status_id=pending_status_id,
            requester_user_id=requester_user_id,
            note=note,
        )
        self._db.add(req)
        self._db.flush()

        detail = CardFreezeRequestDetail(request_id=req.request_id, card_id=card_id)
        self._db.add(detail)
        self._db.commit()
        self._db.refresh(req)
        return req

    def list_freezes(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        status_id: int | None = None,
        type_names: tuple[str, ...] = ("card_freeze", "card_unfreeze"),
    ) -> list[Request]:
        type_ids = [tid for tid in (self.get_type_id(n) for n in type_names) if tid is not None]
        stmt = select(Request).where(Request.request_type_id.in_(type_ids))
        if status_id is not None:
            stmt = stmt.where(Request.request_status_id == status_id)
        stmt = stmt.order_by(Request.created_at.desc()).limit(limit).offset(offset)
        return list(self._db.scalars(stmt).all())

    def count_freezes(
        self,
        *,
        status_id: int | None = None,
        type_names: tuple[str, ...] = ("card_freeze", "card_unfreeze"),
    ) -> int:
        from sqlalchemy import func

        type_ids = [tid for tid in (self.get_type_id(n) for n in type_names) if tid is not None]
        stmt = (
            select(func.count())
            .select_from(Request)
            .where(Request.request_type_id.in_(type_ids))
        )
        if status_id is not None:
            stmt = stmt.where(Request.request_status_id == status_id)
        return int(self._db.execute(stmt).scalar_one())

    def approve_freeze(self, request: Request, *, target_status_id: int) -> Request:
        """Set the target card to the given status and mark the request approved.

        ``target_status_id`` is the frozen status for a freeze request, or the
        active status for an unfreeze request.
        """
        detail = request.card_freeze_detail
        card = self._db.scalars(
            select(Card).where(Card.card_id == detail.card_id).with_for_update()
        ).first()
        if card is not None:
            card.status_id = target_status_id

        approved_status_id = self.get_status_id("approved")
        request.request_status_id = approved_status_id
        request.resolved_at = datetime.now(timezone.utc)

        self._db.commit()
        self._db.refresh(request)
        return request

    def decline_freeze(self, request: Request) -> Request:
        declined_status_id = self.get_status_id("declined")
        request.request_status_id = declined_status_id
        request.resolved_at = datetime.now(timezone.utc)
        self._db.commit()
        self._db.refresh(request)
        return request

    def get_card_status_id_by_name(self, name: str) -> int | None:
        from models.card_status import CardStatus

        stmt = select(CardStatus.card_status_id).where(CardStatus.status_name == name)
        return self._db.execute(stmt).scalar_one_or_none()

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
