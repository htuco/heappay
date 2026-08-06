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
        self,
        *,
        dependent_user_id: int | None = None,
        card_id: int | None = None,
        category_id: int | None,
    ) -> list[SpendingLimitRule]:
        """Return all enabled rules for one of three exact scopes:

        - `card_id=None, dependent_user_id=Y`: Y's cap on their own card(s).
        - `card_id=X, dependent_user_id=None`: the overall cap on shared card X.
        - `card_id=X, dependent_user_id=Y`: Y's own cap on shared card X.

        `card_id`/`dependent_user_id` are matched by exact equality (including
        `IS NULL`) since these are three distinct limit types, not one rule
        broadening -- unlike `category_id`, where NULL means "applies to all
        categories" for the *same* rule (kept as an OR-NULL match below).
        Unlike `CategoryRuleRepository`, this returns *every* matching rule —
        independent constraints that all bind at once, not a first-match
        resolver.
        """
        dependent_clause = (
            SpendingLimitRule.dependent_user_id.is_(None)
            if dependent_user_id is None
            else SpendingLimitRule.dependent_user_id == dependent_user_id
        )
        card_clause = (
            SpendingLimitRule.card_id.is_(None)
            if card_id is None
            else SpendingLimitRule.card_id == card_id
        )
        stmt = select(SpendingLimitRule).where(
            dependent_clause,
            card_clause,
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
        dependent_user_id: int | None = None,
        card_id: int | None = None,
        category_id: int | None,
        period: str,
        now: datetime,
    ) -> Decimal:
        """Sum of outgoing transactions in the current period window, scoped
        to match `list_applicable`'s three cases:

        - `card_id=None`: dependent's spend across any card they own (join on
          `Card.user_id`, the original behavior).
        - `card_id=X, dependent_user_id=None`: every member's combined spend
          on shared card X (no dependent filter, no Card join needed).
        - `card_id=X, dependent_user_id=Y`: just Y's spend on shared card X,
          via `Transaction.initiated_by_user_id` -- `Card.user_id` is always
          the guardian for a shared card, so it can't answer "whose spend".
        """
        window_start = period_start(period, now)
        if card_id is None:
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
        else:
            stmt = (
                select(func.coalesce(func.sum(Transaction.amount), 0))
                .select_from(Transaction)
                .join(
                    TransactionStatus,
                    TransactionStatus.transaction_status_id == Transaction.status_id,
                )
                .where(
                    Transaction.sender_card_id == card_id,
                    Transaction.created_at >= window_start,
                    TransactionStatus.name.in_(_SPEND_STATUS_NAMES),
                )
            )
            if dependent_user_id is not None:
                stmt = stmt.where(Transaction.initiated_by_user_id == dependent_user_id)
        if category_id is not None:
            stmt = stmt.where(Transaction.category_id == category_id)
        return Decimal(self._db.execute(stmt).scalar_one())

    def list_for_dependent(self, dependent_user_id: int) -> list[SpendingLimitRule]:
        stmt = (
            select(SpendingLimitRule)
            .where(
                SpendingLimitRule.dependent_user_id == dependent_user_id,
                SpendingLimitRule.card_id.is_(None),
            )
            .order_by(SpendingLimitRule.spending_limit_rule_id)
        )
        return list(self._db.scalars(stmt).all())

    def get_for_dependent(
        self, dependent_user_id: int, spending_limit_rule_id: int
    ) -> SpendingLimitRule | None:
        stmt = select(SpendingLimitRule).where(
            SpendingLimitRule.dependent_user_id == dependent_user_id,
            SpendingLimitRule.card_id.is_(None),
            SpendingLimitRule.spending_limit_rule_id == spending_limit_rule_id,
        )
        return self._db.scalars(stmt).first()

    def list_for_card(self, card_id: int) -> list[SpendingLimitRule]:
        """Overall (dependent_user_id IS NULL) rules on a shared card."""
        stmt = (
            select(SpendingLimitRule)
            .where(
                SpendingLimitRule.card_id == card_id,
                SpendingLimitRule.dependent_user_id.is_(None),
            )
            .order_by(SpendingLimitRule.spending_limit_rule_id)
        )
        return list(self._db.scalars(stmt).all())

    def get_for_card(self, card_id: int, spending_limit_rule_id: int) -> SpendingLimitRule | None:
        stmt = select(SpendingLimitRule).where(
            SpendingLimitRule.card_id == card_id,
            SpendingLimitRule.dependent_user_id.is_(None),
            SpendingLimitRule.spending_limit_rule_id == spending_limit_rule_id,
        )
        return self._db.scalars(stmt).first()

    def list_for_card_member(self, card_id: int, dependent_user_id: int) -> list[SpendingLimitRule]:
        """A single member's own rules on a shared card."""
        stmt = (
            select(SpendingLimitRule)
            .where(
                SpendingLimitRule.card_id == card_id,
                SpendingLimitRule.dependent_user_id == dependent_user_id,
            )
            .order_by(SpendingLimitRule.spending_limit_rule_id)
        )
        return list(self._db.scalars(stmt).all())

    def get_for_card_member(
        self, card_id: int, dependent_user_id: int, spending_limit_rule_id: int
    ) -> SpendingLimitRule | None:
        stmt = select(SpendingLimitRule).where(
            SpendingLimitRule.card_id == card_id,
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
