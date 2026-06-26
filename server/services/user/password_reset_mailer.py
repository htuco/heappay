from services.email.mailer import EmailMailer
from settings import Settings


class PasswordResetMailer:
    def __init__(self, settings: Settings) -> None:
        self._mailer = EmailMailer(settings)

    def send_reset_link(self, email: str, reset_url: str) -> None:
        self._mailer.send(
            to=email,
            subject="Reset your Heap password",
            body=(
                "Use this link to reset your Heap password:\n\n"
                f"{reset_url}\n\n"
                "If you did not request this, you can ignore this email."
            ),
        )
