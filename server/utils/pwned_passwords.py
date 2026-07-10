"""HIBP Pwned Passwords integration using k-anonymity.

Fail-open policy:
- If the external service is unavailable/timeouts/errors, password checks are skipped
  so auth flows continue. This avoids blocking account access on third-party outages.
"""

from __future__ import annotations

import hashlib
import logging

import httpx

PASSWORD_PWNED_MESSAGE = (
    "This password appeared in a data breach. Choose a different one."
)

_logger = logging.getLogger(__name__)


def sha1_hex_upper(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest().upper()


def is_password_pwned(
    password: str,
    *,
    api_base_url: str,
    timeout_seconds: float,
) -> bool:
    full_hash = sha1_hex_upper(password)
    prefix, suffix = full_hash[:5], full_hash[5:]
    url = f"{api_base_url.rstrip('/')}/range/{prefix}"
    response = httpx.get(
        url,
        timeout=timeout_seconds,
        headers={"Add-Padding": "true"},
    )
    response.raise_for_status()

    for raw_line in response.text.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        candidate_suffix, _count = line.split(":", 1)
        if candidate_suffix.upper() == suffix:
            return True
    return False


def validate_password_not_pwned(
    password: str,
    *,
    hibp_enabled: bool,
    hibp_api_base_url: str,
    hibp_timeout_seconds: float,
) -> None:
    if not hibp_enabled:
        return

    try:
        if is_password_pwned(
            password,
            api_base_url=hibp_api_base_url,
            timeout_seconds=hibp_timeout_seconds,
        ):
            raise ValueError(PASSWORD_PWNED_MESSAGE)
    except httpx.HTTPError:
        # Fail-open by product decision. Never log password/hash/prefix.
        _logger.warning(
            "HIBP password check unavailable; continuing with fail-open policy."
        )
