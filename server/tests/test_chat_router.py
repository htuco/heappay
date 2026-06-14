"""Chat route degradation tests.

When the AI provider key is not configured, /chat/message must fail visibly with
a clear 503 instead of an opaque 500 from the Groq client.
"""

import os

from fastapi.testclient import TestClient

from routes.chat.chat import get_chat_service
from routes.dependencies import UserContext, get_user_context

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402
import routes.chat.chat as chat_route  # noqa: E402


class _Settings:
    def __init__(self, groq_api_key: str) -> None:
        self.groq_api_key = groq_api_key


class FakeChatService:
    def send_message(self, user_id, message, *, is_admin):
        return "hello", []


def _build_client() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_user_context] = lambda: UserContext(
        user_id=1, is_admin=False, is_staff=False
    )
    app.dependency_overrides[get_chat_service] = lambda: FakeChatService()
    return TestClient(app)


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
