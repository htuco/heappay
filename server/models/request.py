from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Request(Base):
    __tablename__ = "requests"
    __table_args__ = (
        Index("idx_requests_requester", "requester_user_id"),
        Index("idx_requests_status_type", "request_status_id", "request_type_id"),
        {"schema": "requests"},
    )

    request_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    request_type_id: Mapped[int] = mapped_column(
        ForeignKey("requests.request_types.request_type_id"), nullable=False
    )
    request_status_id: Mapped[int] = mapped_column(
        ForeignKey("requests.request_statuses.request_status_id"), nullable=False
    )
    requester_user_id: Mapped[int] = mapped_column(
        ForeignKey("identity.users.user_id"), nullable=False
    )
    target_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("identity.users.user_id"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    request_type = relationship("RequestType", back_populates="requests")
    request_status = relationship("RequestStatus", back_populates="requests")
    requester = relationship("User", foreign_keys=[requester_user_id])
    target = relationship("User", foreign_keys=[target_user_id])
    refund_detail = relationship(
        "RefundRequestDetail", back_populates="request", uselist=False, cascade="all, delete-orphan"
    )
    card_freeze_detail = relationship(
        "CardFreezeRequestDetail", back_populates="request", uselist=False, cascade="all, delete-orphan"
    )
    money_request_detail = relationship(
        "MoneyRequestDetail", back_populates="request", uselist=False, cascade="all, delete-orphan"
    )
