"""Admin audit log routes: list, event types, CSV export."""

import os
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from routes.audit_log.audit_log import get_audit_log_service
from routes.dependencies import require_admin
from schemas.audit_log import AuditLogEventResponse, AuditLogEventTypeOption
from schemas.pagination import Page

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402


class FakeAuditLogService:
    def list_event_types(self) -> list[AuditLogEventTypeOption]:
        return [AuditLogEventTypeOption(value="login_success", label="Login success")]

    def list_events(self, **kwargs):
        item = AuditLogEventResponse(
            event_id=1,
            event_type="login_success",
            event_label="Login success",
            actor_user_id=2,
            actor_name="Admin User",
            actor_email="admin@heap.demo",
            target_user_id=2,
            target_name="Admin User",
            target_email="admin@heap.demo",
            resource_type="user",
            resource_id="2",
            detail=None,
            ip_address="127.0.0.1",
            created_at=datetime.now(timezone.utc),
        )
        return [item], 1

    def export_csv(self, **kwargs) -> str:
        return "event_id,created_at\n1,2024-01-01T00:00:00+00:00\n"


def _client() -> TestClient:
    app = create_app()
    app.dependency_overrides[require_admin] = lambda: 1
    app.dependency_overrides[get_audit_log_service] = lambda: FakeAuditLogService()
    return TestClient(app)


def test_list_audit_log_returns_page() -> None:
    client = _client()
    response = client.get("/admin/audit-log")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["total"] == 1
    assert body["data"]["items"][0]["event_type"] == "login_success"


def test_list_event_types_returns_options() -> None:
    client = _client()
    response = client.get("/admin/audit-log/event-types")
    assert response.status_code == 200
    body = response.json()
    assert body["data"][0]["value"] == "login_success"


def test_export_csv_returns_attachment() -> None:
    client = _client()
    response = client.get("/admin/audit-log/export.csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    assert "event_id" in response.text


def test_list_audit_log_requires_admin() -> None:
    app = create_app()
    app.dependency_overrides.pop(require_admin, None)
    client = TestClient(app)
    response = client.get("/admin/audit-log")
    assert response.status_code in {401, 403}
