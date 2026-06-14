import logging
import smtplib
from email.message import EmailMessage

from settings import Settings

logger = logging.getLogger(__name__)


class PasswordResetMailer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send_reset_link(self, email: str, reset_url: str) -> None:
        if not self.settings.smtp_host:
            logger.info("Password reset link for %s: %s", email, reset_url)
            return

        message = EmailMessage()
        message["Subject"] = "Reset your Heap password"
        message["From"] = self.settings.mail_from
        message["To"] = email
        message.set_content(
            "Use this link to reset your Heap password:\n\n"
            f"{reset_url}\n\n"
            "If you did not request this, you can ignore this email."
        )

        with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port) as smtp:
            if self.settings.smtp_use_tls:
                smtp.starttls()
            if self.settings.smtp_username:
                smtp.login(
                    self.settings.smtp_username,
                    self.settings.smtp_password or "",
                )
            smtp.send_message(message)
