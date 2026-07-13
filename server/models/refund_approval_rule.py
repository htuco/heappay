from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class RefundApprovalRule(Base):
    """Admin-configurable thresholds the refund processor evaluates pending
    refunds against. Single row (singleton), edited from the admin UI.
    """

    __tablename__ = "refund_approval_rules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    auto_approve_max_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    max_age_days: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.user_id"), nullable=True
    )

    updated_by = relationship("User")
