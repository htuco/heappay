from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
        UniqueConstraint("idempotency_key", name="uq_transactions_idempotency_key"),
    )

    transaction_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Nullable: deposits originate externally and have no sender card
    sender_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("cards.card_id", ondelete="RESTRICT"), nullable=True
    )
    recipient_card_id: Mapped[int] = mapped_column(
        ForeignKey("cards.card_id", ondelete="RESTRICT"), nullable=False
    )
    transaction_type_id: Mapped[int] = mapped_column(
        ForeignKey("transaction_types.transaction_type_id"), nullable=False
    )
    status_id: Mapped[int] = mapped_column(
        ForeignKey("transaction_statuses.transaction_status_id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processing_eligible_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    processed_by: Mapped[str | None] = mapped_column(String(20), nullable=True)
    deny_reason_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    requires_user_approval: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    user_approval_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    user_approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    user_approval_method: Mapped[str | None] = mapped_column(String(20), nullable=True)

    recurring_payment_id: Mapped[int | None] = mapped_column(
        ForeignKey("recurring_payments.recurring_payment_id", ondelete="SET NULL"),
        nullable=True,
    )

    sender_card = relationship("Card", foreign_keys=[sender_card_id])
    recipient_card = relationship("Card", foreign_keys=[recipient_card_id])
    transaction_type = relationship("TransactionType", back_populates="transactions")
    status = relationship("TransactionStatus", back_populates="transactions")
    refund_detail = relationship("RefundRequestDetail", back_populates="transaction", uselist=False)
    approval_events = relationship(
        "PaymentApprovalEvent",
        back_populates="transaction",
        order_by="PaymentApprovalEvent.created_at",
    )
