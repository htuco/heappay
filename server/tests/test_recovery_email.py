from datetime import datetime, timezone
from types import SimpleNamespace

from utils.user_notification_email import is_recovery_email_verified, notification_email_for_user


def _user(
    *,
    email: str = "login@heap.demo",
    recovery_email: str | None = None,
    recovery_email_verified_at: datetime | None = None,
):
    return SimpleNamespace(
        email=email,
        recovery_email=recovery_email,
        recovery_email_verified_at=recovery_email_verified_at,
    )


def test_notification_email_uses_login_when_no_recovery() -> None:
    user = _user()
    assert notification_email_for_user(user) == "login@heap.demo"


def test_notification_email_ignores_unverified_recovery() -> None:
    user = _user(
        recovery_email="recovery@heap.demo",
        recovery_email_verified_at=None,
    )
    assert notification_email_for_user(user) == "login@heap.demo"


def test_notification_email_uses_verified_recovery() -> None:
    user = _user(
        recovery_email="recovery@heap.demo",
        recovery_email_verified_at=datetime.now(timezone.utc),
    )
    assert notification_email_for_user(user) == "recovery@heap.demo"
    assert is_recovery_email_verified(user) is True
