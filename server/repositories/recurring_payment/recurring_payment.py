from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from models.card import Card
from models.recurring_payment import RecurringPayment


class RecurringPaymentRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def _commit(self) -> None:
        try:
            self._db.commit()
        except SQLAlchemyError:
            self._db.rollback()
            raise

    def _load_options(self):
        return (
            joinedload(RecurringPayment.sender_card).joinedload(Card.user),
            joinedload(RecurringPayment.sender_card).joinedload(Card.card_type),
            joinedload(RecurringPayment.recipient_card).joinedload(Card.user),
            joinedload(RecurringPayment.recipient_card).joinedload(Card.card_type),
        )

    def create(
        self,
        *,
        user_id: int,
        sender_card_id: int,
        recipient_card_id: int,
        amount: Decimal,
        day_of_month: int,
        months: list[int] | None,
        note: str | None,
        next_due_at: date,
    ) -> RecurringPayment:
        row = RecurringPayment(
            user_id=user_id,
            sender_card_id=sender_card_id,
            recipient_card_id=recipient_card_id,
            amount=amount,
            day_of_month=day_of_month,
            months=",".join(str(m) for m in months) if months else None,
            note=note,
            next_due_at=next_due_at,
            status="active",
            last_run_failed=False,
        )
        self._db.add(row)
        self._commit()
        self._db.refresh(row)
        return self.get_by_id(row.recurring_payment_id)

    def get_by_id(self, recurring_payment_id: int) -> RecurringPayment | None:
        stmt = (
            select(RecurringPayment)
            .options(*self._load_options())
            .where(RecurringPayment.recurring_payment_id == recurring_payment_id)
        )
        return self._db.scalars(stmt).first()

    def list_for_user(self, user_id: int) -> list[RecurringPayment]:
        stmt = (
            select(RecurringPayment)
            .options(*self._load_options())
            .where(RecurringPayment.user_id == user_id)
            .order_by(
                (RecurringPayment.status != "active").asc(),
                RecurringPayment.created_at.desc(),
            )
        )
        return list(self._db.scalars(stmt).unique().all())

    def list_due(self, as_of: date) -> list[RecurringPayment]:
        stmt = (
            select(RecurringPayment)
            .options(
                joinedload(RecurringPayment.sender_card),
                joinedload(RecurringPayment.recipient_card),
            )
            .where(
                RecurringPayment.status == "active",
                RecurringPayment.next_due_at <= as_of,
            )
        )
        return list(self._db.scalars(stmt).unique().all())

    def update(self, row: RecurringPayment, **kwargs) -> RecurringPayment:
        for k, v in kwargs.items():
            setattr(row, k, v)
        self._commit()
        self._db.refresh(row)
        return self.get_by_id(row.recurring_payment_id)

    def cancel(self, row: RecurringPayment) -> None:
        row.status = "cancelled"
        row.cancelled_at = datetime.now(timezone.utc)
        self._commit()
