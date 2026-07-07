from services.email.mailer import EmailMailer
from settings import Settings


class RecoveryEmailMailer:
    def __init__(self, settings: Settings) -> None:
        self._mailer = EmailMailer(settings)

    def send_verification_link(self, email: str, verify_url: str) -> None:
        self._mailer.send(
            to=email,
            subject="Verify your Heap recovery email",
            body=(
                "Confirm this address as your Heap recovery email:\n\n"
                f"{verify_url}\n\n"
                "This link expires in 24 hours and can only be used once.\n"
                "Your login email stays the same — this address is only for "
                "password reset and account alerts.\n\n"
                "If you did not request this, you can ignore this email."
            ),
        )
