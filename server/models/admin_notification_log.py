from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AdminNotificationLog(Base):
    """Audit + dedup ledger for admin notifications on user requests.

    One row per (recipient, event, reference). Doubles as the dedup guard so
    the transaction processor (which re-runs on a schedule) never notifies an
    admin twice about the same flagged transaction.
    """

    __tablename__ = "admin_notification_log"
    __table_args__ = (
        UniqueConstraint(
            "recipient_user_id",
            "event_type",
            "reference_id",
            name="uq_admin_notification_recipient_event_ref",
        ),
        {"schema": "comms"},
    )

    admin_notification_log_id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True
    )
    recipient_user_id: Mapped[int] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="CASCADE"), nullable=False
    )
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_id: Mapped[str] = mapped_column(String(128), nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False, server_default="email")
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
