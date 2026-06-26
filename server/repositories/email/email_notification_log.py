from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.email_notification_log import EmailNotificationLog


class EmailNotificationLogRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def try_record_send(self, *, user_id: int, event_type: str, reference_id: str) -> bool:
        """Insert dedup row. Returns True if this is the first send for this key."""
        row = EmailNotificationLog(
            user_id=user_id,
            event_type=event_type,
            reference_id=reference_id,
        )
        self._db.add(row)
        try:
            self._db.commit()
            return True
        except IntegrityError:
            self._db.rollback()
            return False

    def was_sent(self, *, user_id: int, event_type: str, reference_id: str) -> bool:
        stmt = select(EmailNotificationLog.email_notification_log_id).where(
            EmailNotificationLog.user_id == user_id,
            EmailNotificationLog.event_type == event_type,
            EmailNotificationLog.reference_id == reference_id,
        )
        return self._db.execute(stmt).scalar_one_or_none() is not None
