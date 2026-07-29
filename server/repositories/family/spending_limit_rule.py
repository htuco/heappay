from datetime import datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from models.card import Card
from models.spending_limit_rule import SpendingLimitRule
from models.transaction import Transaction
from models.transaction_status import TransactionStatus

# Statuses that count as "spent" toward a period cap — a pending transaction
# already holds the funds in escrow, a completed one has settled. Failed and
# cancelled transactions never actually moved money, so they don't count.
_SPEND_STATUS_NAMES = ("pending", "completed")


def period_start(period: str, now: datetime) -> datetime:
    """Start of the current daily/weekly/monthly window containing `now`."""
    today_start = datetime.combine(now.date(), time.min, tzinfo=now.tzinfo)
    if period == "daily":
        return today_start
    if period == "weekly":
        return today_start - timedelta(days=now.weekday())
    if period == "monthly":
        return today_start.replace(day=1)
    raise ValueError(f"Unknown period: {period}")


class SpendingLimitRuleRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_applicable(
        self, *, dependent_user_id: int, category_id: int | None
    ) -> list[SpendingLimitRule]:
        """Return all enabled rules that apply to a transaction in this
        category (or category-agnostic rules, category_id IS NULL). Unlike
        `CategoryRuleRepository`, this returns *every* matching rule — an
        overall cap and a category-specific cap are independent constraints
        that both bind at once, not a first-match resolver.
        """
        stmt = select(SpendingLimitRule).where(
            SpendingLimitRule.dependent_user_id == dependent_user_id,
            SpendingLimitRule.enabled.is_(True),
            or_(
                SpendingLimitRule.category_id.is_(None),
                SpendingLimitRule.category_id == category_id,
            ),
        )
        return list(self._db.scalars(stmt).all())

    def sum_period_spend(
        self,
        *,
        dependent_user_id: int,
        category_id: int | None,
        period: str,
        now: datetime,
    ) -> Decimal:
        """Sum of this dependent's outgoing transactions in the current
        period window, optionally scoped to a category. `category_id=None`
        sums across all categories (for an overall cap).
        """
        window_start = period_start(period, now)
        stmt = (
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .select_from(Transaction)
            .join(Card, Card.card_id == Transaction.sender_card_id)
            .join(
                TransactionStatus,
                TransactionStatus.transaction_status_id == Transaction.status_id,
            )
            .where(
                Card.user_id == dependent_user_id,
                Transaction.created_at >= window_start,
                TransactionStatus.name.in_(_SPEND_STATUS_NAMES),
            )
        )
        if category_id is not None:
            stmt = stmt.where(Transaction.category_id == category_id)
        return Decimal(self._db.execute(stmt).scalar_one())

    def list_for_dependent(self, dependent_user_id: int) -> list[SpendingLimitRule]:
        stmt = (
            select(SpendingLimitRule)
            .where(SpendingLimitRule.dependent_user_id == dependent_user_id)
            .order_by(SpendingLimitRule.spending_limit_rule_id)
        )
        return list(self._db.scalars(stmt).all())

    def get_for_dependent(
        self, dependent_user_id: int, spending_limit_rule_id: int
    ) -> SpendingLimitRule | None:
        stmt = select(SpendingLimitRule).where(
            SpendingLimitRule.dependent_user_id == dependent_user_id,
            SpendingLimitRule.spending_limit_rule_id == spending_limit_rule_id,
        )
        return self._db.scalars(stmt).first()

    def create(self, row: SpendingLimitRule) -> SpendingLimitRule:
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def save(self, row: SpendingLimitRule) -> SpendingLimitRule:
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete(self, row: SpendingLimitRule) -> None:
        self._db.delete(row)
        self._db.commit()
