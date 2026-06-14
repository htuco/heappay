"""Shared rate limiter.

A single `Limiter` instance keyed by client IP, used to throttle the
brute-forceable auth routes (login / register / refresh). Imported by both the
route modules (for the `@limiter.limit(...)` decorators) and `main.py` (to wire
the handler + middleware).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Conservative defaults — enough to stop brute-forcing without tripping a normal
# user who mistypes a password a few times.
AUTH_RATE_LIMIT = "10/minute"
