"""Shared rate limiter.

A single `Limiter` instance keyed by client IP by default. Route modules can
override the key function for authenticated per-user budgets or global buckets.
"""

from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Conservative defaults — enough to stop brute-forcing without tripping a normal
# user who mistypes a password a few times.
AUTH_RATE_LIMIT = "10/minute"
RECOVERY_EMAIL_RATE_LIMIT = "5/minute"
DEFAULT_RATE_LIMIT_MESSAGE = "Too many attempts. Please wait a moment and try again."

# Throttle authenticated transaction creation so a single user cannot spam the
# endpoint. Keyed by user id (see `user_id_key_func`), not IP.
TRANSACTION_RATE_LIMIT = "10/minute"

CHAT_USER_RATE_LIMIT = "20/minute"
CHAT_GLOBAL_RATE_LIMIT = "100/minute"
CHAT_RATE_LIMIT_MESSAGE = (
    "You are sending messages too quickly. Please wait a moment and try again."
)


def user_id_key_func(request: Request) -> str:
    """Rate-limit key for authenticated routes: bucket by the JWT subject so the
    limit is per-user, not per-IP. Falls back to the client IP when the bearer
    token is missing or invalid (unauthenticated/garbage requests still get a
    bucket instead of crashing the limiter)."""
    # Imported lazily to avoid a circular import at module load time
    # (services -> repositories -> models all pull in plenty of app modules).
    from services.user.auth import decode_access_token_subject

    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() == "bearer" and token:
        user_id = decode_access_token_subject(token)
        if user_id is not None:
            return f"user:{user_id}"
    return get_remote_address(request)


def global_chat_key_func(request: Request) -> str:
    """Single shared bucket for /chat/message across all callers."""
    return "chat:global"
