import logging
from decimal import Decimal

from sqlalchemy.orm import Session

from repositories.family.family_notification import FamilyNotificationRepository
from repositories.user.user import UserRepository
from services.email import family_templates
from services.email.mailer import EmailMailer
from settings import get_settings
from utils.user_notification_email import notification_email_for_user

logger = logging.getLogger(__name__)

EVENT_FAMILY_LINK_INVITED = "family_link_invited"
EVENT_FAMILY_LINK_ACCEPTED = "family_link_accepted"
EVENT_ALLOWANCE_RECEIVED = "allowance_received"
EVENT_SPENDING_LIMIT_CHANGED = "spending_limit_changed"
EVENT_APPROVAL_REQUESTED = "approval_requested"
EVENT_SHARED_CARD_SPEND = "shared_card_spend"


class FamilyNotificationService:
    """Emails a guardian or dependent about family-package activity.

    Fail-open by design, same posture as `AdminNotificationService`: a
    mail/DB hiccup here must never block the action that triggered it, so
    every public method swallows its own errors. Gated by the recipient's
    `email_family_activity_enabled` opt-out preference.
    """

    def __init__(self, db: Session) -> None:
        self._db = db
        self._settings = get_settings()
        self._mailer = EmailMailer(self._settings)
        self._repo = FamilyNotificationRepository(db)
        self._users = UserRepository(db)

    def notify_family_link_invited(self, *, family_link_id: int, dependent_user_id: int, guardian_user_id: int) -> None:
        try:
            dependent = self._users.get_by_id(dependent_user_id)
            guardian = self._users.get_by_id(guardian_user_id)
            if dependent is None or guardian is None:
                return
            subject, body = family_templates.family_link_invited(
                guardian_name=_full_name(guardian)
            )
            self._send(
                recipient=dependent,
                event_type=EVENT_FAMILY_LINK_INVITED,
                reference_id=str(family_link_id),
                subject=subject,
                body=body,
            )
        except Exception:
            logger.exception("Family-link-invited notification failed (link %s)", family_link_id)

    def notify_family_link_accepted(self, *, family_link_id: int, dependent_user_id: int, guardian_user_id: int) -> None:
        try:
            dependent = self._users.get_by_id(dependent_user_id)
            guardian = self._users.get_by_id(guardian_user_id)
            if dependent is None or guardian is None:
                return
            subject, body = family_templates.family_link_accepted(
                dependent_name=_full_name(dependent)
            )
            self._send(
                recipient=guardian,
                event_type=EVENT_FAMILY_LINK_ACCEPTED,
                reference_id=str(family_link_id),
                subject=subject,
                body=body,
            )
        except Exception:
            logger.exception("Family-link-accepted notification failed (link %s)", family_link_id)

    def notify_allowance_received(
        self, *, dependent_user_id: int, guardian_user_id: int, amount: Decimal, reference_id: str
    ) -> None:
        try:
            dependent = self._users.get_by_id(dependent_user_id)
            guardian = self._users.get_by_id(guardian_user_id)
            if dependent is None or guardian is None:
                return
            subject, body = family_templates.allowance_received(
                guardian_name=_full_name(guardian), amount=amount
            )
            self._send(
                recipient=dependent,
                event_type=EVENT_ALLOWANCE_RECEIVED,
                reference_id=reference_id,
                subject=subject,
                body=body,
            )
        except Exception:
            logger.exception("Allowance-received notification failed (dependent %s)", dependent_user_id)

    def notify_spending_limit_changed(
        self, *, dependent_user_id: int, guardian_user_id: int, reference_id: str
    ) -> None:
        try:
            dependent = self._users.get_by_id(dependent_user_id)
            guardian = self._users.get_by_id(guardian_user_id)
            if dependent is None or guardian is None:
                return
            subject, body = family_templates.spending_limit_changed(
                guardian_name=_full_name(guardian)
            )
            self._send(
                recipient=dependent,
                event_type=EVENT_SPENDING_LIMIT_CHANGED,
                reference_id=reference_id,
                subject=subject,
                body=body,
            )
        except Exception:
            logger.exception("Spending-limit-changed notification failed (dependent %s)", dependent_user_id)

    def notify_approval_requested(
        self, *, guardian_user_id: int, dependent_user_id: int, amount: Decimal, transaction_id: int
    ) -> None:
        try:
            guardian = self._users.get_by_id(guardian_user_id)
            dependent = self._users.get_by_id(dependent_user_id)
            if guardian is None or dependent is None:
                return
            subject, body = family_templates.approval_requested(
                dependent_name=_full_name(dependent), amount=amount
            )
            self._send(
                recipient=guardian,
                event_type=EVENT_APPROVAL_REQUESTED,
                reference_id=str(transaction_id),
                subject=subject,
                body=body,
            )
        except Exception:
            logger.exception("Approval-requested notification failed (tx %s)", transaction_id)

    def notify_shared_card_spend(
        self,
        *,
        guardian_user_id: int,
        dependent_user_id: int,
        amount: Decimal,
        transaction_id: int,
        card_id: int,
    ) -> None:
        try:
            guardian = self._users.get_by_id(guardian_user_id)
            dependent = self._users.get_by_id(dependent_user_id)
            if guardian is None or dependent is None:
                return
            subject, body = family_templates.shared_card_spend(
                dependent_name=_full_name(dependent), amount=amount
            )
            self._send(
                recipient=guardian,
                event_type=EVENT_SHARED_CARD_SPEND,
                reference_id=str(transaction_id),
                subject=subject,
                body=body,
            )
        except Exception:
            logger.exception("Shared-card-spend notification failed (tx %s)", transaction_id)

    def _send(self, *, recipient, event_type: str, reference_id: str, subject: str, body: str) -> None:
        if not getattr(recipient, "email_family_activity_enabled", True):
            return
        email = notification_email_for_user(recipient)
        if not email:
            return
        if not self._repo.try_record_send(
            recipient_user_id=recipient.user_id,
            recipient_email=email,
            event_type=event_type,
            reference_id=reference_id,
        ):
            return
        try:
            self._mailer.send(to=email, subject=subject, body=body)
        except Exception:
            logger.exception("Failed to send family email [%s] to %s", subject, email)


def _full_name(user) -> str:
    name = f"{user.first_name} {user.last_name}".strip()
    return name or user.email
