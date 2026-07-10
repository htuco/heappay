from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.audit_log.audit_log import AuditLogRepository
from routes.dependencies import require_admin
from schemas.audit_log import AuditLogEventResponse, AuditLogEventTypeOption
from schemas.pagination import Page
from schemas.response import ApiResponse
from services.audit_log.audit_log import AuditLogService

router = APIRouter(prefix="/admin/audit-log", tags=["admin-audit-log"])


def get_audit_log_service(db: Session = Depends(get_db)) -> AuditLogService:
    return AuditLogService(AuditLogRepository(db))


def _parse_date_param(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if "T" in text:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    parsed = datetime.fromisoformat(text)
    if end_of_day:
        return parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    return parsed


@router.get("", response_model=ApiResponse[Page[AuditLogEventResponse]])
def list_audit_log(
    _: int = Depends(require_admin),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    event_type: str | None = Query(default=None, max_length=50),
    actor_user_id: int | None = Query(default=None, ge=1),
    target_user_id: int | None = Query(default=None, ge=1),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    service: AuditLogService = Depends(get_audit_log_service),
) -> ApiResponse[Page[AuditLogEventResponse]]:
    items, total = service.list_events(
        page=page,
        page_size=page_size,
        event_type=event_type,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        from_date=_parse_date_param(from_date),
        to_date=_parse_date_param(to_date, end_of_day=True),
        q=q,
    )
    return ApiResponse[Page[AuditLogEventResponse]](
        success=True,
        message="Audit log retrieved.",
        data=Page.build(items=items, total=total, page=page, page_size=page_size),
    )


@router.get("/event-types", response_model=ApiResponse[list[AuditLogEventTypeOption]])
def list_audit_event_types(
    _: int = Depends(require_admin),
    service: AuditLogService = Depends(get_audit_log_service),
) -> ApiResponse[list[AuditLogEventTypeOption]]:
    return ApiResponse[list[AuditLogEventTypeOption]](
        success=True,
        message="Audit event types retrieved.",
        data=service.list_event_types(),
    )


@router.get("/export.csv")
def export_audit_log_csv(
    _: int = Depends(require_admin),
    event_type: str | None = Query(default=None, max_length=50),
    actor_user_id: int | None = Query(default=None, ge=1),
    target_user_id: int | None = Query(default=None, ge=1),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    service: AuditLogService = Depends(get_audit_log_service),
) -> Response:
    csv_text = service.export_csv(
        event_type=event_type,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        from_date=_parse_date_param(from_date),
        to_date=_parse_date_param(to_date, end_of_day=True),
        q=q,
    )
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit-log.csv"'},
        status_code=status.HTTP_200_OK,
    )
