import logging
import smtplib
from email.message import EmailMessage

from settings import Settings

logger = logging.getLogger(__name__)


class EmailMailer:
    """Shared SMTP sender for transactional email."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def is_configured(self) -> bool:
        return bool(self.settings.smtp_host)

    def send(self, *, to: str, subject: str, body: str) -> bool:
        if not self.is_configured:
            logger.info("Email to %s [%s]: %s", to, subject, body.replace("\n", " | "))
            return True

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self.settings.mail_from
        message["To"] = to
        message.set_content(body)

        with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port) as smtp:
            if self.settings.smtp_use_tls:
                smtp.starttls()
            if self.settings.smtp_username:
                smtp.login(
                    self.settings.smtp_username,
                    self.settings.smtp_password or "",
                )
            smtp.send_message(message)
        return True
