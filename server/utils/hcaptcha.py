import httpx

from settings import get_settings


HCAPTCHA_FAILURE_MESSAGE = "Please complete the security check and try again."


def verify_hcaptcha_token(token: str | None, remote_ip: str | None = None) -> None:
    settings = get_settings()
    secret = settings.hcaptcha_secret_key.strip()
    if not secret:
        return

    if not token:
        raise ValueError("HCAPTCHA_REQUIRED")

    data = {
        "secret": secret,
        "response": token,
    }
    if remote_ip:
        data["remoteip"] = remote_ip

    try:
        response = httpx.post(settings.hcaptcha_verify_url, data=data, timeout=5)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ValueError("HCAPTCHA_VERIFICATION_FAILED") from exc

    if payload.get("success") is not True:
        raise ValueError("HCAPTCHA_VERIFICATION_FAILED")
