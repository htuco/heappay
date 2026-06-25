"""Chat route degradation and rate-limit tests.

When the AI provider key is not configured, /chat/message must fail visibly with
a clear 503 instead of an opaque 500 from the Groq client.
"""

from datetime import datetime, timedelta, timezone
import os

import jwt
from fastapi.testclient import TestClient

from ratelimit import CHAT_GLOBAL_RATE_LIMIT, CHAT_RATE_LIMIT_MESSAGE, CHAT_USER_RATE_LIMIT
from routes.chat.chat import get_chat_service
from routes.dependencies import UserContext, get_user_context
from settings import get_settings

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402
import routes.chat.chat as chat_route  # noqa: E402


class _Settings:
    def __init__(self, groq_api_key: str) -> None:
        self.groq_api_key = groq_api_key


class FakeChatService:
    def send_message(self, user_id, message, *, is_admin, agent_mode=False):
        return "hello", []


_CHAT_USER_LIMIT = int(CHAT_USER_RATE_LIMIT.split("/")[0])
_CHAT_GLOBAL_LIMIT = int(CHAT_GLOBAL_RATE_LIMIT.split("/")[0])


def _build_client() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_user_context] = lambda: UserContext(
        user_id=1, is_admin=False, is_staff=False
    )
    app.dependency_overrides[get_chat_service] = lambda: FakeChatService()
    return TestClient(app)


def _access_token(user_id: int) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _headers(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {_access_token(user_id)}"}


def test_send_message_returns_503_when_key_unset(monkeypatch) -> None:
    monkeypatch.setattr(chat_route, "get_settings", lambda: _Settings(""))
    client = _build_client()
    response = client.post("/chat/message", json={"message": "hi"})
    assert response.status_code == 503
    assert "not configured" in response.json()["message"]


def test_send_message_proceeds_when_key_set(monkeypatch) -> None:
    monkeypatch.setattr(chat_route, "get_settings", lambda: _Settings("test-key"))
    client = _build_client()
    response = client.post("/chat/message", json={"message": "hi"})
    assert response.status_code == 200
    assert response.json()["reply"] == "hello"


def test_send_message_is_rate_limited_per_user(monkeypatch) -> None:
    monkeypatch.setattr(chat_route, "get_settings", lambda: _Settings("test-key"))
    client = _build_client()
    headers = _headers(1)

    for _ in range(_CHAT_USER_LIMIT):
        response = client.post("/chat/message", json={"message": "hi"}, headers=headers)
        assert response.status_code == 200

    blocked = client.post("/chat/message", json={"message": "hi"}, headers=headers)
    assert blocked.status_code == 429
    assert blocked.json() == {
        "code": "RATE_LIMITED",
        "message": CHAT_RATE_LIMIT_MESSAGE,
        "details": None,
    }


def test_send_message_has_global_rate_limit(monkeypatch) -> None:
    monkeypatch.setattr(chat_route, "get_settings", lambda: _Settings("test-key"))
    client = _build_client()

    for user_id in range(_CHAT_GLOBAL_LIMIT):
        response = client.post(
            "/chat/message",
            json={"message": "hi"},
            headers=_headers(user_id + 1),
        )
        assert response.status_code == 200

    blocked = client.post(
        "/chat/message",
        json={"message": "hi"},
        headers=_headers(_CHAT_GLOBAL_LIMIT + 1),
    )
    assert blocked.status_code == 429
    assert blocked.json()["message"] == CHAT_RATE_LIMIT_MESSAGE
