from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class SpendingLimitRule(Base):
    """A guardian-configured spending cap on a dependent's own transactions.

    `category_id` NULL means the cap applies across all categories; a set
    `category_id` scopes it to that category only. Multiple rules can apply
    to the same transaction at once (an overall cap and a category cap are
    independent constraints, not a first-match resolver like `CategoryRule`).
    `requires_approval_above` / `requires_approval_always` redirect the
    dependent's transaction into the existing approval workflow instead of
    (or in addition to) capping it outright.
    """

    __tablename__ = "spending_limit_rules"
    __table_args__ = (
        CheckConstraint(
            "period IN ('daily', 'weekly', 'monthly')", name="ck_spending_limit_rules_period_valid"
        ),
        CheckConstraint("max_amount > 0", name="ck_spending_limit_rules_max_amount_positive"),
    )

    spending_limit_rule_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    dependent_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("transaction_categories.transaction_category_id"), nullable=True
    )
    period: Mapped[str] = mapped_column(String(10), nullable=False)
    max_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    requires_approval_above: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    requires_approval_always: Mapped[bool] = mapped_column(
        Boolean(), nullable=False, server_default="false"
    )
    enabled: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default=true())
    updated_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    dependent = relationship("User", foreign_keys=[dependent_user_id])
    category = relationship("TransactionCategory")
