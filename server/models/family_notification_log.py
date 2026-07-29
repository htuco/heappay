from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class FamilyNotificationLog(Base):
    """Audit + dedup ledger for guardian<->dependent family notifications.

    Same shape as `AdminNotificationLog`, but recipients here are ordinary
    users (guardians or dependents), not staff. One row per (recipient,
    event, reference); the unique constraint doubles as the dedup guard.
    """

    __tablename__ = "family_notification_log"
    __table_args__ = (
        UniqueConstraint(
            "recipient_user_id",
            "event_type",
            "reference_id",
            name="uq_family_notification_recipient_event_ref",
        ),
        # Declared explicitly so the name matches the migration; under a schema
        # SQLAlchemy would auto-name it ix_comms_family_notification_log_*.
        # Note this duplicates the leading column of the unique constraint above,
        # so it is a candidate for the same F-10 cleanup as its siblings.
        Index("ix_family_notification_log_recipient_user_id", "recipient_user_id"),
        {"schema": "comms"},
    )

    family_notification_log_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
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
