from services.email.mailer import EmailMailer
from settings import Settings


class EmailVerificationMailer:
    def __init__(self, settings: Settings) -> None:
        self._mailer = EmailMailer(settings)

    def send_verification_link(self, email: str, verify_url: str) -> None:
        self._mailer.send(
            to=email,
            subject="Verify your Heap email address",
            body=(
                "Use this link to verify your email address:\n\n"
                f"{verify_url}\n\n"
                "If you did not create a Heap account, you can ignore this email."
            ),
        )
