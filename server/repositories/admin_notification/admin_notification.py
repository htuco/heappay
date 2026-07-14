from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.admin_notification_log import AdminNotificationLog
from models.user import User
from models.user_role import UserRole

# Roles treated as staff for admin notifications.
STAFF_ROLE_NAMES = ("admin", "support")


class AdminNotificationRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_opted_in_recipients(self) -> list[User]:
        """Active staff users who opted in and have an email address."""
        stmt = (
            select(User)
            .join(UserRole, User.user_role_id == UserRole.role_id)
            .where(
                UserRole.role_name.in_(STAFF_ROLE_NAMES),
                User.notify_on_user_requests.is_(True),
                User.deleted_at.is_(None),
                User.email.is_not(None),
            )
        )
        return list(self._db.scalars(stmt).all())

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
        row = AdminNotificationLog(
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
