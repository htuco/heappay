from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import case, func, or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from models.card import Card
from models.refund_request_detail import RefundRequestDetail
from models.request import Request
from models.transaction import Transaction
from models.user import User
from models.user_role import UserRole
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

    def _commit(self) -> None:
        try:
            self._db.commit()
        except SQLAlchemyError:
            self._db.rollback()
            raise

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
    ) -> list[Transaction]:
        """List transactions where the user owns either the sender or recipient card."""
        stmt = (
            self._filtered_user_transactions_stmt(
                user_id,
                status_id=status_id,
                transaction_type_id=transaction_type_id,
                category_id=category_id,
                from_date=from_date,
                to_date=to_date,
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
        category_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(
            self._filtered_user_transactions_stmt(
                user_id,
                status_id=status_id,
                transaction_type_id=transaction_type_id,
                category_id=category_id,
                from_date=from_date,
                to_date=to_date,
            ).subquery()
        )
        return int(self._db.execute(stmt).scalar_one())

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
    ) -> list[Transaction]:
        stmt = (
            self._filtered_all_transactions_stmt(
                status_id=status_id,
                transaction_type_id=transaction_type_id,
                category_id=category_id,
                from_date=from_date,
                to_date=to_date,
                user_role_name=user_role_name,
            )
            .options(*self._party_load_options())
            .order_by(_SORT_COLUMNS.get(sort, _SORT_COLUMNS["newest"]))
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).all())

    def count_all(
        self,
        *,
        status_id: int | None = None,
        transaction_type_id: int | None = None,
        category_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        user_role_name: str | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(
            self._filtered_all_transactions_stmt(
                status_id=status_id,
                transaction_type_id=transaction_type_id,
                category_id=category_id,
                from_date=from_date,
                to_date=to_date,
                user_role_name=user_role_name,
            ).subquery()
        )
        return int(self._db.execute(stmt).scalar_one())

    def _transaction_filter_clauses(
        self,
        *,
        status_id: int | None = None,
        transaction_type_id: int | None = None,
        category_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        user_role_name: str | None = None,
    ) -> list:
        clauses = []
        if status_id is not None:
            clauses.append(Transaction.status_id == status_id)
        if transaction_type_id is not None:
            clauses.append(Transaction.transaction_type_id == transaction_type_id)
        if category_id is not None:
            clauses.append(Transaction.category_id == category_id)
        if from_date is not None:
            clauses.append(func.date(Transaction.created_at) >= from_date)
        if to_date is not None:
            clauses.append(func.date(Transaction.created_at) <= to_date)
        if user_role_name is not None:
            role_card_ids = (
                select(Card.card_id)
                .join(User, Card.user_id == User.user_id)
                .join(UserRole, User.user_role_id == UserRole.role_id)
                .where(UserRole.role_name == user_role_name)
            )
            clauses.append(
                or_(
                    Transaction.sender_card_id.in_(role_card_ids),
                    Transaction.recipient_card_id.in_(role_card_ids),
                )
            )
        return clauses

    def _filtered_all_transactions_stmt(
        self,
        *,
        status_id: int | None,
        transaction_type_id: int | None,
        category_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        user_role_name: str | None = None,
    ):
        stmt = select(Transaction)
        for clause in self._transaction_filter_clauses(
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
            from_date=from_date,
            to_date=to_date,
            user_role_name=user_role_name,
        ):
            stmt = stmt.where(clause)
        return stmt

    def _user_transactions_stmt(self, user_id: int):
        user_card_ids = select(Card.card_id).where(Card.user_id == user_id)
        return select(Transaction).where(
            or_(
                Transaction.sender_card_id.in_(user_card_ids),
                Transaction.recipient_card_id.in_(user_card_ids),
                # A dependent who spent from a shared card they don't own
                # (sender_card.user_id is the guardian) still participates in
                # that transaction -- initiated_by_user_id is the only way to
                # know that from the transaction row alone.
                Transaction.initiated_by_user_id == user_id,
            )
        )

    def _filtered_user_transactions_stmt(
        self,
        user_id: int,
        *,
        status_id: int | None,
        transaction_type_id: int | None,
        category_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ):
        stmt = self._user_transactions_stmt(user_id)
        for clause in self._transaction_filter_clauses(
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
            from_date=from_date,
            to_date=to_date,
        ):
            stmt = stmt.where(clause)
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

    def get_category_breakdown_for_user(
        self,
        *,
        user_id: int,
        months: int = 6,
    ) -> list[dict]:
        """
        Aggregate outgoing spend per category for the given user over the window.

        "Spending" = transactions where one of the user's cards is the **sender**
        (money leaving). Incoming is excluded so the breakdown reconciles to total
        outgoing. The Uncategorised bucket (category_id = NULL) is included so the
        segments sum to total spend. Matches get_summary_for_user by counting only
        completed transactions.
        """
        from models.transaction_category import TransactionCategory

        user_card_ids = (
            select(Card.card_id).where(Card.user_id == user_id).scalar_subquery()
        )
        since = func.now() - text(f"INTERVAL '{int(months)} months'")
        completed_id = self.get_status_id_by_name("completed")

        filters = [
            Transaction.created_at >= since,
            Transaction.sender_card_id.in_(user_card_ids),
        ]
        if completed_id is not None:
            filters.append(Transaction.status_id == completed_id)

        stmt = (
            select(
                Transaction.category_id.label("category_id"),
                TransactionCategory.name.label("name"),
                func.coalesce(func.sum(Transaction.amount), Decimal("0")).label("total"),
                func.count(Transaction.transaction_id).label("count"),
            )
            .select_from(Transaction)
            .outerjoin(
                TransactionCategory,
                Transaction.category_id
                == TransactionCategory.transaction_category_id,
            )
            .where(*filters)
            .group_by(Transaction.category_id, TransactionCategory.name)
            .order_by(func.sum(Transaction.amount).desc())
        )

        return [dict(r) for r in self._db.execute(stmt).mappings().all()]

    def get_category_timeseries_for_user(
        self,
        *,
        user_id: int,
        days: int,
    ) -> list[dict]:
        """
        Monthly outgoing spend per category for the given user over the trailing
        window of ``days``.

        Same scope as ``get_category_breakdown_for_user`` (sender = money
        leaving, completed only, Uncategorised bucket included) but bucketed by
        calendar month, so the analytics page can chart month-on-month movement
        per category. Returns one row per (month, category) pair; the caller
        pivots these into per-category series aligned to a period axis.
        """
        from models.transaction_category import TransactionCategory

        user_card_ids = (
            select(Card.card_id).where(Card.user_id == user_id).scalar_subquery()
        )
        since = func.now() - text(f"INTERVAL '{int(days)} days'")
        completed_id = self.get_status_id_by_name("completed")

        period_col = func.to_char(
            func.date_trunc("month", Transaction.created_at), "YYYY-MM"
        )

        filters = [
            Transaction.created_at >= since,
            Transaction.sender_card_id.in_(user_card_ids),
        ]
        if completed_id is not None:
            filters.append(Transaction.status_id == completed_id)

        stmt = (
            select(
                period_col.label("period"),
                Transaction.category_id.label("category_id"),
                TransactionCategory.name.label("name"),
                func.coalesce(func.sum(Transaction.amount), Decimal("0")).label("total"),
                func.count(Transaction.transaction_id).label("count"),
            )
            .select_from(Transaction)
            .outerjoin(
                TransactionCategory,
                Transaction.category_id
                == TransactionCategory.transaction_category_id,
            )
            .where(*filters)
            .group_by(period_col, Transaction.category_id, TransactionCategory.name)
            .order_by(period_col.asc())
        )

        return [dict(r) for r in self._db.execute(stmt).mappings().all()]

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
        filter_clauses = self._transaction_filter_clauses(
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            from_date=from_date,
            to_date=to_date,
            user_role_name=user_role_name,
        )

        period_col = func.to_char(
            func.date_trunc("month", Transaction.created_at), "YYYY-MM"
        )
        monthly_filters = list(filter_clauses)
        if from_date is not None or to_date is not None:
            pass
        else:
            since = func.now() - text(f"INTERVAL '{int(months)} months'")
            monthly_filters.append(Transaction.created_at >= since)

        completed_id = self.get_status_id_by_name("completed")
        if completed_id is not None and status_id is None:
            monthly_filters.append(Transaction.status_id == completed_id)

        monthly_stmt = (
            select(
                period_col.label("period"),
                func.count(Transaction.transaction_id).label("count"),
                func.coalesce(func.sum(Transaction.amount), Decimal("0")).label("volume"),
            )
            .where(*monthly_filters)
            .group_by(period_col)
            .order_by(period_col.desc())
        )

        status_stmt = (
            select(
                TransactionStatus.name.label("name"),
                func.count(Transaction.transaction_id).label("count"),
            )
            .select_from(TransactionStatus)
            .join(
                Transaction,
                Transaction.status_id == TransactionStatus.transaction_status_id,
            )
            .where(*filter_clauses)
            .group_by(TransactionStatus.name)
            .order_by(TransactionStatus.name.asc())
        )

        type_stmt = (
            select(
                TransactionType.name.label("name"),
                func.count(Transaction.transaction_id).label("count"),
            )
            .select_from(TransactionType)
            .join(
                Transaction,
                Transaction.transaction_type_id == TransactionType.transaction_type_id,
            )
            .where(*filter_clauses)
            .group_by(TransactionType.name)
            .order_by(TransactionType.name.asc())
        )

        completed_volume = Decimal("0")
        completed_clauses = list(filter_clauses)
        if completed_id is not None:
            completed_clauses.append(Transaction.status_id == completed_id)
        completed_volume_stmt = select(
            func.coalesce(func.sum(Transaction.amount), Decimal("0"))
        ).where(*completed_clauses)
        completed_volume = self._db.execute(completed_volume_stmt).scalar_one()

        total_count_stmt = select(func.count()).select_from(
            self._filtered_all_transactions_stmt(
                status_id=status_id,
                transaction_type_id=transaction_type_id,
                from_date=from_date,
                to_date=to_date,
                user_role_name=user_role_name,
            ).subquery()
        )

        return {
            "monthly": [dict(r) for r in self._db.execute(monthly_stmt).mappings().all()],
            "by_status": {
                row["name"]: int(row["count"])
                for row in self._db.execute(status_stmt).mappings().all()
            },
            "by_type": {
                row["name"]: int(row["count"])
                for row in self._db.execute(type_stmt).mappings().all()
            },
            "total_count": int(self._db.execute(total_count_stmt).scalar_one()),
            "completed_volume": completed_volume,
            "months": months,
        }

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

    def get_by_idempotency_key(self, idempotency_key: str) -> Transaction | None:
        stmt = (
            select(Transaction)
            .options(*self._party_load_options())
            .where(Transaction.idempotency_key == idempotency_key)
        )
        return self._db.scalars(stmt).first()

    def find_recent_duplicate(
        self,
        sender_card_id: int,
        recipient_card_id: int,
        amount: Decimal,
        window_seconds: int,
    ) -> Transaction | None:
        """Return any non-failed/cancelled tx with the same sender, recipient, and amount
        created within the duplicate window, or None if no such transaction exists."""
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
        excluded_statuses = ["failed", "cancelled"]
        excluded_ids = [
            sid
            for name in excluded_statuses
            if (sid := self.get_status_id_by_name(name)) is not None
        ]
        stmt = select(Transaction).where(
            Transaction.sender_card_id == sender_card_id,
            Transaction.recipient_card_id == recipient_card_id,
            Transaction.amount == amount,
            Transaction.created_at >= cutoff,
        )
        if excluded_ids:
            stmt = stmt.where(Transaction.status_id.not_in(excluded_ids))
        return self._db.scalars(stmt).first()

    def rollback(self) -> None:
        self._db.rollback()

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

    def list_pending_approvals_for_approver(self, approver_user_id: int) -> list[Transaction]:
        """Transactions awaiting approval where `approver_user_id` is the
        authorized approver -- e.g. a guardian's view of dependents' pending
        approvals, redirected there by a spending-limit rule.
        """
        stmt = (
            select(Transaction)
            .options(*self._party_load_options())
            .where(
                Transaction.approver_user_id == approver_user_id,
                Transaction.requires_user_approval.is_(True),
                Transaction.user_approved_at.is_(None),
            )
            .order_by(Transaction.created_at.desc())
        )
        return list(self._db.scalars(stmt).all())

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
        category_id: int | None = None,
        idempotency_key: str | None = None,
        requires_user_approval: bool = False,
        user_approval_expires_at: datetime | None = None,
        approver_user_id: int | None = None,
        initiated_by_user_id: int | None = None,
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
            category_id=category_id,
            amount=amount,
            note=note,
            processing_eligible_at=processing_eligible_at,
            idempotency_key=idempotency_key,
            requires_user_approval=requires_user_approval,
            user_approval_expires_at=user_approval_expires_at,
            approver_user_id=approver_user_id,
            initiated_by_user_id=initiated_by_user_id,
        )
        self._db.add(row)
        self._commit()
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

    def cancel(
        self,
        transaction_id: int,
        *,
        reason_code: str,
        processed_by: str,
    ) -> Transaction:
        """Cancel a pending transaction at the owner's request.

        Releases the held funds back to the sender (escrow only ever debited the
        sender on create, so there is nothing to claw back from the recipient) and
        stamps the distinct ``cancelled`` status so a user cancel reads differently
        from a processor-driven ``failed``.
        """
        pending_id = self.get_status_id_by_name("pending")
        cancelled_id = self.get_status_id_by_name("cancelled")
        if pending_id is None or cancelled_id is None:
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

        row.status_id = cancelled_id
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
        self._commit()
        self._db.refresh(row)
        return row

    def get_transaction_type_name(self, transaction_type_id: int) -> str | None:
        stmt = select(TransactionType.name).where(
            TransactionType.transaction_type_id == transaction_type_id
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def approve_user_confirmation(
        self,
        transaction_id: int,
        *,
        approval_method: str,
    ) -> Transaction:
        """Record in-app user approval for a pending sensitive payment."""
        pending_id = self.get_status_id_by_name("pending")
        if pending_id is None:
            raise TransactionStateError("Required transaction status not found.")

        row = self._get_transaction_for_update(transaction_id)
        if row is None:
            raise TransactionStateError("Transaction not found.")
        if row.status_id != pending_id:
            raise TransactionStateError("Transaction is not pending.")
        if not row.requires_user_approval:
            raise TransactionStateError("Transaction does not require user approval.")
        if row.user_approved_at is not None:
            raise TransactionStateError("Transaction is already approved.")

        now = datetime.now(timezone.utc)
        expires = row.user_approval_expires_at
        if expires is not None:
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if now > expires:
                raise TransactionStateError("Approval window has expired.")

        row.user_approved_at = now
        row.user_approval_method = approval_method
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

    def transaction_category_exists(self, category_id: int) -> bool:
        from models.transaction_category import TransactionCategory

        stmt = select(TransactionCategory.transaction_category_id).where(
            TransactionCategory.transaction_category_id == category_id
        )
        return self._db.execute(stmt).first() is not None

    def get_status_id_by_name(self, name: str) -> int | None:
        stmt = select(TransactionStatus.transaction_status_id).where(
            TransactionStatus.name == name
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def get_type_id_by_name(self, name: str) -> int | None:
        stmt = select(TransactionType.transaction_type_id).where(
            TransactionType.name == name
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def get_card_status_id_by_name(self, name: str) -> int | None:
        from models.card_status import CardStatus

        stmt = select(CardStatus.card_status_id).where(CardStatus.status_name == name)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_transaction_type_id_by_name(self, name: str) -> int | None:
        stmt = select(TransactionType.transaction_type_id).where(TransactionType.name == name)
        return self._db.execute(stmt).scalar_one_or_none()

    def create_recurring_transaction(
        self,
        *,
        sender_card: Card,
        recipient_card: Card,
        transaction_type_id: int,
        status_id: int,
        amount: Decimal,
        note: str | None,
        processing_eligible_at: datetime,
        recurring_payment_id: int,
        category_id: int | None = None,
    ) -> Transaction:
        sender_card.balance = sender_card.balance - amount
        row = Transaction(
            sender_card_id=sender_card.card_id,
            recipient_card_id=recipient_card.card_id,
            transaction_type_id=transaction_type_id,
            status_id=status_id,
            category_id=category_id,
            amount=amount,
            note=note,
            processing_eligible_at=processing_eligible_at,
            recurring_payment_id=recurring_payment_id,
        )
        self._db.add(row)
        self._commit()
        self._db.refresh(row)
        return row
