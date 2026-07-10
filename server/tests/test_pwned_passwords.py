from urllib.parse import urlparse

import httpx

from utils.pwned_passwords import (
    PASSWORD_PWNED_MESSAGE,
    is_password_pwned,
    sha1_hex_upper,
    validate_password_not_pwned,
)


def test_sha1_hex_upper_matches_known_value() -> None:
    assert sha1_hex_upper("password") == "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8"


def test_is_password_pwned_uses_k_anonymity_prefix(monkeypatch) -> None:
    seen_url: dict[str, str] = {}
    seen_headers: dict[str, str] = {}

    def fake_get(url: str, *, timeout: float, headers: dict[str, str]) -> httpx.Response:
        seen_url["value"] = url
        seen_headers.update(headers)
        # "password" => prefix 5BAA6, suffix 1E4C...
        body = "1E4C9B93F3F0682250B6CF8331B7EE68FD8:500\r\nABCDEF:1\r\n"
        return httpx.Response(200, text=body, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", fake_get)

    assert (
        is_password_pwned(
            "password",
            api_base_url="https://api.pwnedpasswords.com",
            timeout_seconds=3.0,
        )
        is True
    )

    parsed = urlparse(seen_url["value"])
    assert parsed.path == "/range/5BAA6"
    # ensure full hash is not sent
    assert "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8" not in seen_url["value"]
    assert seen_headers.get("Add-Padding") == "true"


def test_validate_password_not_pwned_raises_for_breached_password(monkeypatch) -> None:
    monkeypatch.setattr(
        "utils.pwned_passwords.is_password_pwned",
        lambda password, **kwargs: password == "password",
    )

    try:
        validate_password_not_pwned(
            "password",
            hibp_enabled=True,
            hibp_api_base_url="https://api.pwnedpasswords.com",
            hibp_timeout_seconds=3.0,
        )
    except ValueError as exc:
        assert str(exc) == PASSWORD_PWNED_MESSAGE
    else:  # pragma: no cover
        raise AssertionError("Expected breached password to be rejected")


def test_validate_password_not_pwned_fails_open_when_hibp_unavailable(monkeypatch) -> None:
    def fake_is_password_pwned(password: str, **_kwargs) -> bool:
        raise httpx.TimeoutException("timeout")

    monkeypatch.setattr("utils.pwned_passwords.is_password_pwned", fake_is_password_pwned)

    # Fail-open: no error should be raised
    validate_password_not_pwned(
        "VeryUniquePassword!123",
        hibp_enabled=True,
        hibp_api_base_url="https://api.pwnedpasswords.com",
        hibp_timeout_seconds=0.001,
    )
