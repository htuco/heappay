from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class UserSecurityAuditEvent(Base):
    __tablename__ = "user_security_events"
    __table_args__ = (Index("ix_user_security_audit_events_user_id", "user_id"),
        Index("ix_user_security_events_created_at", "created_at"),
        Index("ix_user_security_events_event_type", "event_type"),
        {"schema": "audit"},
    )

    event_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("identity.users.user_id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    detail: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user = relationship("User", back_populates="security_audit_events")
