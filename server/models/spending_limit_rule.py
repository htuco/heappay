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
    """A guardian-configured spending cap, scoped one of three ways:

    - `card_id` NULL, `dependent_user_id` set: a cap on that dependent's own
      transactions, on any card they own (the original per-dependent model).
    - `card_id` set, `dependent_user_id` NULL: the guardian's overall cap on a
      *shared* card, summed across every member's combined spend on it.
    - `card_id` set, `dependent_user_id` set: that member's own cap
      specifically on that shared card.

    These are three distinct limit types, matched by exact equality (including
    `IS NULL`) -- not the "NULL broadens" pattern `category_id` uses below,
    where a NULL category means "applies to all categories" for the *same*
    rule. Multiple rules can apply to the same transaction at once (independent
    constraints, not a first-match resolver like `CategoryRule`).
    `requires_approval_above` / `requires_approval_always` redirect the
    transaction into the existing approval workflow instead of (or in addition
    to) capping it outright.
    """

    __tablename__ = "spending_limit_rules"
    __table_args__ = (
        CheckConstraint(
            "period IN ('daily', 'weekly', 'monthly')", name="ck_spending_limit_rules_period_valid"
        ),
        CheckConstraint("max_amount > 0", name="ck_spending_limit_rules_max_amount_positive"),
        CheckConstraint(
            "dependent_user_id IS NOT NULL OR card_id IS NOT NULL",
            name="ck_spending_limit_rules_scope_required",
        ),
    )

    spending_limit_rule_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    dependent_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True
    )
    card_id: Mapped[int | None] = mapped_column(
        ForeignKey("cards.card_id", ondelete="CASCADE"), nullable=True
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
    card = relationship("Card")
    category = relationship("TransactionCategory")
