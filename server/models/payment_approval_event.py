from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class PaymentApprovalEvent(Base):
    __tablename__ = "payment_approval_events"
    __table_args__ = (Index("ix_payment_approval_events_transaction_id", "transaction_id"),
        Index("ix_payment_approval_events_actor_user_id", "actor_user_id"),
        {"schema": "audit"},
    )

    event_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("money.transactions.transaction_id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="SET NULL"), nullable=True
    )
    verification_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    detail: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    transaction = relationship("Transaction", back_populates="approval_events")
