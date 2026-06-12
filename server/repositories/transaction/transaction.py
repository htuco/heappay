from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import case, func, or_, select, text
from sqlalchemy.orm import Session, joinedload

from models.card import Card
from models.refund_request_detail import RefundRequestDetail
from models.request import Request
from models.transaction import Transaction
from models.user import User
from models.transaction_status import TransactionStatus
from models.transaction_type import TransactionType


class TransactionStateError(Exception):
    """Transaction is not in the expected state for this operation."""


_SORT_COLUMNS = {
    "newest": Transaction.created_at.desc(),
    "oldest": Transaction.created_at.asc(),
    "amount_desc": Transaction.amount.desc(),
    "amount_asc": Transaction.amount.asc(),
}


class TransactionRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_for_user(
        self,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        status_id: int | None = None,
        transaction_type_id: int | None = None,
        sort: str = "newest",
    ) -> list[Transaction]:
        """List transactions where the user owns either the sender or recipient card."""
        stmt = (
            self._filtered_user_transactions_stmt(
                user_id,
                status_id=status_id,
                transaction_type_id=transaction_type_id,
            )
            .options(*self._party_load_options())
            .order_by(_SORT_COLUMNS.get(sort, _SORT_COLUMNS["newest"]))
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).all())

    def count_for_user(
        self,
        *,
        user_id: int,
        status_id: int | None = None,
        transaction_type_id: int | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(
            self._filtered_user_transactions_stmt(
                user_id,
                status_id=status_id,
                transaction_type_id=transaction_type_id,
            ).subquery()
        )
        return int(self._db.execute(stmt).scalar_one())

    def list_all(self, *, limit: int = 50, offset: int = 0) -> list[Transaction]:
        stmt = (
            select(Transaction)
            .options(*self._party_load_options())
            .order_by(Transaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).all())

    def count_all(self) -> int:
        stmt = select(func.count()).select_from(Transaction)
        return int(self._db.execute(stmt).scalar_one())

    def _user_transactions_stmt(self, user_id: int):
        user_card_ids = select(Card.card_id).where(Card.user_id == user_id)
        return select(Transaction).where(
            or_(
                Transaction.sender_card_id.in_(user_card_ids),
                Transaction.recipient_card_id.in_(user_card_ids),
            )
        )

    def _filtered_user_transactions_stmt(
        self,
        user_id: int,
        *,
        status_id: int | None,
        transaction_type_id: int | None,
    ):
        stmt = self._user_transactions_stmt(user_id)
        if status_id is not None:
            stmt = stmt.where(Transaction.status_id == status_id)
        if transaction_type_id is not None:
            stmt = stmt.where(Transaction.transaction_type_id == transaction_type_id)
        return stmt

    def get_summary_for_user(
        self,
        *,
        user_id: int,
        months: int = 6,
    ) -> list[dict]:
        """
        Aggregate income and expense per calendar month for the given user.

        Income  = amount credited to a card the user owns (recipient).
        Expense = amount debited from a card the user owns (sender).
        Transfers between the user's own cards count as both, so they cancel
        out in the net — which is the correct accounting view.
        """
        user_card_ids = select(Card.card_id).where(Card.user_id == user_id).scalar_subquery()

        since = func.now() - text(f"INTERVAL '{int(months)} months'")
        completed_id = self.get_status_id_by_name("completed")

        period_col = func.to_char(
            func.date_trunc("month", Transaction.created_at), "YYYY-MM"
        )

        income_expr = func.coalesce(
            func.sum(
                case(
                    (Transaction.recipient_card_id.in_(user_card_ids), Transaction.amount),
                    else_=Decimal("0"),
                )
            ),
            Decimal("0"),
        )

        expense_expr = func.coalesce(
            func.sum(
                case(
                    (Transaction.sender_card_id.in_(user_card_ids), Transaction.amount),
                    else_=Decimal("0"),
                )
            ),
            Decimal("0"),
        )

        filters = [
            Transaction.created_at >= since,
            or_(
                Transaction.recipient_card_id.in_(user_card_ids),
                Transaction.sender_card_id.in_(user_card_ids),
            ),
        ]
        if completed_id is not None:
            filters.append(Transaction.status_id == completed_id)

        stmt = (
            select(
                period_col.label("period"),
                income_expr.label("income"),
                expense_expr.label("expense"),
            )
            .where(*filters)
            .group_by(period_col)
            .order_by(period_col.desc())
        )

        return [dict(r) for r in self._db.execute(stmt).mappings().all()]

    def list_for_card(
        self,
        *,
        card_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Transaction]:
        """List transactions where card_id appears as sender or recipient."""
        stmt = (
            self._card_transactions_stmt(card_id)
            .options(*self._party_load_options())
            .order_by(Transaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).all())

    def count_for_card(self, *, card_id: int) -> int:
        stmt = select(func.count()).select_from(
            self._card_transactions_stmt(card_id).subquery()
        )
        return int(self._db.execute(stmt).scalar_one())

    def _card_transactions_stmt(self, card_id: int):
        return select(Transaction).where(
            or_(
                Transaction.sender_card_id == card_id,
                Transaction.recipient_card_id == card_id,
            )
        )

    def get_by_id(self, transaction_id: int) -> Transaction | None:
        stmt = (
            select(Transaction)
            .options(*self._party_load_options())
            .where(Transaction.transaction_id == transaction_id)
        )
        return self._db.scalars(stmt).first()

    def _party_load_options(self):
        return (
            joinedload(Transaction.sender_card).joinedload(Card.user),
            joinedload(Transaction.sender_card).joinedload(Card.card_type),
            joinedload(Transaction.recipient_card).joinedload(Card.user),
            joinedload(Transaction.recipient_card).joinedload(Card.card_type),
            # Eager-load the refund chain so has_pending_refund / refund_status on
            # TransactionResponse don't trigger a lazy query per row (N+1).
            joinedload(Transaction.refund_detail)
            .joinedload(RefundRequestDetail.request)
            .joinedload(Request.request_status),
        )

    def card_owner_id(self, card_id: int) -> int | None:
        stmt = select(Card.user_id).where(
            Card.card_id == card_id, Card.deleted_at.is_(None)
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def get_card_for_update(self, card_id: int) -> Card | None:
        """Lock card row for the duration of the transaction (SELECT ... FOR UPDATE)."""
        stmt = (
            select(Card)
            .where(Card.card_id == card_id, Card.deleted_at.is_(None))
            .with_for_update()
        )
        return self._db.scalars(stmt).first()

    def create_with_balance_update(
        self,
        *,
        sender_card: Card | None,
        recipient_card: Card,
        transaction_type_id: int,
        status_id: int,
        amount: Decimal,
        note: str | None,
        processing_eligible_at: datetime,
    ) -> Transaction:
        """
        Escrow create: hold funds on sender (if any); recipient is credited on complete().
        Deposits (no sender) do not move balances until complete().
        """
        if sender_card is not None:
            sender_card.balance = sender_card.balance - amount

        row = Transaction(
            sender_card_id=sender_card.card_id if sender_card is not None else None,
            recipient_card_id=recipient_card.card_id,
            transaction_type_id=transaction_type_id,
            status_id=status_id,
            amount=amount,
            note=note,
            processing_eligible_at=processing_eligible_at,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def list_pending_for_update(self, *, limit: int) -> list[Transaction]:
        pending_id = self.get_status_id_by_name("pending")
        if pending_id is None:
            return []

        # Lock rows on transactions only — FOR UPDATE with outer joins (deposits
        # have no sender_card) is rejected by PostgreSQL.
        lock_stmt = (
            select(Transaction.transaction_id)
            .where(
                Transaction.status_id == pending_id,
                Transaction.processing_eligible_at <= func.now(),
            )
            .order_by(
                Transaction.processing_eligible_at.asc(),
                Transaction.created_at.asc(),
            )
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        ids = list(self._db.scalars(lock_stmt).all())
        if not ids:
            return []

        stmt = (
            select(Transaction)
            .where(Transaction.transaction_id.in_(ids))
            .options(
                joinedload(Transaction.sender_card).joinedload(Card.user).joinedload(
                    User.status
                ),
                joinedload(Transaction.sender_card).joinedload(Card.status),
                joinedload(Transaction.recipient_card).joinedload(Card.user).joinedload(
                    User.status
                ),
                joinedload(Transaction.recipient_card).joinedload(Card.status),
            )
            .order_by(
                Transaction.processing_eligible_at.asc(),
                Transaction.created_at.asc(),
            )
        )
        return list(self._db.scalars(stmt).unique().all())

    def complete(self, transaction_id: int, *, processed_by: str) -> Transaction:
        pending_id = self.get_status_id_by_name("pending")
        completed_id = self.get_status_id_by_name("completed")
        if pending_id is None or completed_id is None:
            raise TransactionStateError("Required transaction status not found.")

        row = self._get_transaction_for_update(transaction_id)
        if row is None:
            raise TransactionStateError("Transaction not found.")
        if row.status_id != pending_id:
            raise TransactionStateError("Transaction is not pending.")

        recipient_card = self.get_card_for_update(row.recipient_card_id)
        if recipient_card is None:
            raise TransactionStateError("Recipient card not found.")

        recipient_card.balance = recipient_card.balance + row.amount
        row.status_id = completed_id
        row.processed_at = datetime.now(timezone.utc)
        row.processed_by = processed_by
        row.deny_reason_code = None
        self._db.commit()
        self._db.refresh(row)
        return row

    def fail(
        self,
        transaction_id: int,
        *,
        reason_code: str,
        processed_by: str,
    ) -> Transaction:
        pending_id = self.get_status_id_by_name("pending")
        failed_id = self.get_status_id_by_name("failed")
        if pending_id is None or failed_id is None:
            raise TransactionStateError("Required transaction status not found.")

        row = self._get_transaction_for_update(transaction_id)
        if row is None:
            raise TransactionStateError("Transaction not found.")
        if row.status_id != pending_id:
            raise TransactionStateError("Transaction is not pending.")

        if row.sender_card_id is not None:
            sender_card = self.get_card_for_update(row.sender_card_id)
            if sender_card is None:
                raise TransactionStateError("Sender card not found.")
            sender_card.balance = sender_card.balance + row.amount

        row.status_id = failed_id
        row.processed_at = datetime.now(timezone.utc)
        row.processed_by = processed_by
        row.deny_reason_code = reason_code
        self._db.commit()
        self._db.refresh(row)
        return row

    def _get_transaction_for_update(self, transaction_id: int) -> Transaction | None:
        stmt = (
            select(Transaction)
            .where(Transaction.transaction_id == transaction_id)
            .with_for_update()
        )
        return self._db.scalars(stmt).first()

    def update(self, row: Transaction, changes: dict) -> Transaction:
        for key, value in changes.items():
            setattr(row, key, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def transaction_type_exists(self, transaction_type_id: int) -> bool:
        stmt = select(TransactionType.transaction_type_id).where(
            TransactionType.transaction_type_id == transaction_type_id
        )
        return self._db.execute(stmt).first() is not None

    def transaction_status_exists(self, status_id: int) -> bool:
        stmt = select(TransactionStatus.transaction_status_id).where(
            TransactionStatus.transaction_status_id == status_id
        )
        return self._db.execute(stmt).first() is not None

    def get_status_id_by_name(self, name: str) -> int | None:
        stmt = select(TransactionStatus.transaction_status_id).where(
            TransactionStatus.name == name
        )
        return self._db.execute(stmt).scalar_one_or_none()
