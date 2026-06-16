"""Shared rate limiter.

A single `Limiter` instance keyed by client IP, used to throttle the
brute-forceable auth routes (login / register / refresh). Imported by both the
route modules (for the `@limiter.limit(...)` decorators) and `main.py` (to wire
the handler + middleware).
"""

from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Conservative defaults — enough to stop brute-forcing without tripping a normal
# user who mistypes a password a few times.
AUTH_RATE_LIMIT = "10/minute"

# Throttle authenticated transaction creation so a single user cannot spam the
# endpoint. Keyed by user id (see `user_id_key_func`), not IP.
TRANSACTION_RATE_LIMIT = "10/minute"


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
