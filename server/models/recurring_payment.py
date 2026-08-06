from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class RecurringPayment(Base):
    __tablename__ = "recurring_payments"
    __table_args__ = (
        CheckConstraint("day_of_month BETWEEN 1 AND 31", name="ck_recurring_payments_day_of_month"),
        CheckConstraint("amount > 0", name="ck_recurring_payments_amount_positive"),
        Index("ix_recurring_payments_user_status", "user_id", "status"),
        Index("ix_recurring_payments_due", "status", "next_due_on"),
        Index("ix_recurring_payments_sender_card_id", "sender_card_id"),
        Index("ix_recurring_payments_recipient_card_id", "recipient_card_id"),
        Index("ix_recurring_payments_transaction_category_id", "transaction_category_id"),
        # Free-text status with no lookup table and no constraint; both indexes on
        # this table lead with it, so a casing typo silently produces a row the
        # scheduler never matches (audit F-09).
        CheckConstraint(
            "status IN ('active', 'cancelled')",
            name="ck_recurring_payments_status",
        ),
        {"schema": "money"},
    )

    recurring_payment_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("identity.users.user_id", ondelete="CASCADE"), nullable=False)
    sender_card_id: Mapped[int] = mapped_column(ForeignKey("money.cards.card_id", ondelete="RESTRICT"), nullable=False)
    recipient_card_id: Mapped[int] = mapped_column(ForeignKey("money.cards.card_id", ondelete="RESTRICT"), nullable=False)
    # Nullable on purpose, exactly like Transaction.category_id: a rule with no
    # category is "Uncategorised". Categorisation is optional at create time and
    # can be added or removed afterwards.
    category_id: Mapped[int | None] = mapped_column(
        "transaction_category_id",
        ForeignKey("money.transaction_categories.transaction_category_id"),
        nullable=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    day_of_month: Mapped[int] = mapped_column(nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    months: Mapped[str | None] = mapped_column("active_months", String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    next_due_at: Mapped[date] = mapped_column("next_due_on", Date, nullable=False)
    last_run_failed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_run_error: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sender_card = relationship("Card", foreign_keys=[sender_card_id])
    recipient_card = relationship("Card", foreign_keys=[recipient_card_id])
    category = relationship("TransactionCategory")

    @property
    def months_list(self) -> list[int] | None:
        if not self.months:
            return None
        return [int(m) for m in self.months.split(",") if m.strip()]
