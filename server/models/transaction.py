from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
    )

    transaction_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Nullable: deposits originate externally and have no sender card
    sender_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("cards.card_id"), nullable=True
    )
    recipient_card_id: Mapped[int] = mapped_column(
        ForeignKey("cards.card_id"), nullable=False
    )
    transaction_type_id: Mapped[int] = mapped_column(
        ForeignKey("transaction_types.transaction_type_id"), nullable=False
    )
    status_id: Mapped[int] = mapped_column(
        ForeignKey("transaction_statuses.transaction_status_id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
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

    sender_card = relationship("Card", foreign_keys=[sender_card_id])
    recipient_card = relationship("Card", foreign_keys=[recipient_card_id])
    transaction_type = relationship("TransactionType", back_populates="transactions")
    status = relationship("TransactionStatus", back_populates="transactions")
    refund_detail = relationship("RefundRequestDetail", back_populates="transaction", uselist=False)
