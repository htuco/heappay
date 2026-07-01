import time

LOGIN_CAPTCHA_AFTER_FAILURES = 2
_ATTEMPT_TTL_SECONDS = 15 * 60
_failed_attempts: dict[str, tuple[int, float]] = {}


def _attempt_key(email: str, remote_ip: str | None) -> str:
    normalized_email = email.strip().lower()
    ip = remote_ip or "unknown"
    return f"{normalized_email}:{ip}"


def _prune_expired(key: str) -> int:
    entry = _failed_attempts.get(key)
    if entry is None:
        return 0
    count, expires_at = entry
    if expires_at and time.time() > expires_at:
        del _failed_attempts[key]
        return 0
    return count


def get_failed_login_attempts(email: str, remote_ip: str | None = None) -> int:
    key = _attempt_key(email, remote_ip)
    return _prune_expired(key)


def login_requires_hcaptcha(email: str, remote_ip: str | None = None) -> bool:
    return get_failed_login_attempts(email, remote_ip) >= LOGIN_CAPTCHA_AFTER_FAILURES


def record_failed_login(email: str, remote_ip: str | None = None) -> int:
    key = _attempt_key(email, remote_ip)
    count = _prune_expired(key) + 1
    _failed_attempts[key] = (count, time.time() + _ATTEMPT_TTL_SECONDS)
    return count


def clear_failed_login_attempts(email: str, remote_ip: str | None = None) -> None:
    _failed_attempts.pop(_attempt_key(email, remote_ip), None)
