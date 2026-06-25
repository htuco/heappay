from sqlalchemy import select

from models.payment_approval_event import PaymentApprovalEvent


class PaymentApprovalRepository:
    def __init__(self, db) -> None:
        self._db = db

    def record_event(
        self,
        *,
        transaction_id: int,
        event_type: str,
        actor_user_id: int | None = None,
        verification_method: str | None = None,
        detail: str | None = None,
    ) -> PaymentApprovalEvent:
        row = PaymentApprovalEvent(
            transaction_id=transaction_id,
            event_type=event_type,
            actor_user_id=actor_user_id,
            verification_method=verification_method,
            detail=detail,
        )
        self._db.add(row)
        self._db.flush()
        return row

    def list_for_transaction(self, transaction_id: int) -> list[PaymentApprovalEvent]:
        stmt = (
            select(PaymentApprovalEvent)
            .where(PaymentApprovalEvent.transaction_id == transaction_id)
            .order_by(PaymentApprovalEvent.created_at.asc())
        )
        return list(self._db.scalars(stmt).all())
