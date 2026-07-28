from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class RefundApprovalRule(Base):
    """Admin-configurable thresholds the refund processor evaluates pending
    refunds against. Single row (singleton), edited from the admin UI.
    """

    __tablename__ = "refund_approval_policy"
    __table_args__ = (
        # Singleton config row. Nothing prevented a second one, and the service
        # reads a single row -- so a stray insert would change refund-approval
        # behaviour depending on which row won (audit F-14).
        CheckConstraint(
            "refund_approval_policy_id = 1",
            name="ck_refund_approval_policy_singleton",
        ),
        {"schema": "requests"},
    )

    id: Mapped[int] = mapped_column("refund_approval_policy_id", primary_key=True, autoincrement=True)
    enabled: Mapped[bool] = mapped_column("is_enabled", Boolean, nullable=False, server_default="false")
    max_age_days: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("identity.users.user_id"), nullable=True
    )

    updated_by = relationship("User")
