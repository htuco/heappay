from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class EmailNotificationLog(Base):
    """Dedup ledger — one email per (user, event, reference)."""

    __tablename__ = "email_notification_log"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "event_type",
            "reference_id",
            name="uq_email_notification_user_event_ref",
        ),
    )

    email_notification_log_id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_id: Mapped[str] = mapped_column(String(128), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
