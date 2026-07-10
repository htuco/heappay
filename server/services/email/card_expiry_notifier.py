import logging

from sqlalchemy.orm import Session

from repositories.card.card import CardRepository
from repositories.email.email_notification_log import EmailNotificationLogRepository
from services.email import templates
from services.email.mailer import EmailMailer
from settings import get_settings
from utils.user_notification_email import notification_email_for_user

logger = logging.getLogger(__name__)

EVENT_CARD_EXPIRING = "card_expiring"


class CardExpiryNotifier:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._settings = get_settings()
        self._mailer = EmailMailer(self._settings)
        self._dedup = EmailNotificationLogRepository(db)
        self._card_repo = CardRepository(db)

    def notify_expiring_cards(self, *, days: int, limit: int) -> dict[str, int]:
        stats = {"card_expiry_emails_sent": 0, "card_expiry_emails_skipped": 0}
        for card in self._card_repo.list_expiring_soon(days=days, limit=limit):
            if card.user is None:
                continue
            if not self._dedup.try_record_send(
                user_id=card.user_id,
                event_type=EVENT_CARD_EXPIRING,
                reference_id=str(card.card_id),
            ):
                stats["card_expiry_emails_skipped"] += 1
                continue

            subject, body = templates.card_expiring_soon(
                first_name=card.user.first_name,
                last_four=card.last_four,
                expires_at=card.expires_at,
            )
            self._send(notification_email_for_user(card.user), subject, body)
            stats["card_expiry_emails_sent"] += 1
        return stats

    def _send(self, email: str, subject: str, body: str) -> None:
        try:
            self._mailer.send(to=email, subject=subject, body=body)
        except Exception:
            logger.exception("Failed to send email [%s] to %s", subject, email)
