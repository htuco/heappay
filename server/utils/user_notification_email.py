from models.user import User


def is_recovery_email_verified(user: User) -> bool:
    return bool(user.recovery_email and user.recovery_email_verified_at is not None)


def notification_email_for_user(user: User) -> str:
    """Delivery address for password reset and transactional/security email."""
    if is_recovery_email_verified(user):
        return user.recovery_email  # type: ignore[return-value]
    return user.email
