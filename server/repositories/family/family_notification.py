from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.family_notification_log import FamilyNotificationLog


class FamilyNotificationRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def try_record_send(
        self,
        *,
        recipient_user_id: int,
        recipient_email: str,
        event_type: str,
        reference_id: str,
        channel: str = "email",
    ) -> bool:
        """Insert an audit/dedup row.

        Returns True if this is the first notification for
        (recipient, event, reference), False if it was already recorded.
        """
        row = FamilyNotificationLog(
            recipient_user_id=recipient_user_id,
            recipient_email=recipient_email,
            event_type=event_type,
            reference_id=reference_id,
            channel=channel,
        )
        self._db.add(row)
        try:
            self._db.commit()
            return True
        except IntegrityError:
            self._db.rollback()
            return False
