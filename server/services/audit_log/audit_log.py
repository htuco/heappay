import csv
import io
from datetime import datetime

from repositories.audit_log.audit_log import AuditLogRepository
from schemas.audit_log import AuditLogEventResponse, AuditLogEventTypeOption
from utils.audit_log import AUDIT_EVENT_LABELS


def _user_display_name(user) -> str | None:
    if user is None:
        return None
    name = f"{user.first_name} {user.last_name}".strip()
    return name or None


def _to_response(row) -> AuditLogEventResponse:
    return AuditLogEventResponse(
        event_id=row.event_id,
        event_type=row.event_type,
        event_label=AUDIT_EVENT_LABELS.get(row.event_type, row.event_type),
        actor_user_id=row.actor_user_id,
        actor_name=_user_display_name(row.actor),
        actor_email=row.actor.email if row.actor is not None else None,
        target_user_id=row.target_user_id,
        target_name=_user_display_name(row.target),
        target_email=row.target.email if row.target is not None else None,
        resource_type=row.resource_type,
        resource_id=row.resource_id,
        detail=row.detail,
        ip_address=row.ip_address,
        created_at=row.created_at,
    )


class AuditLogService:
    EXPORT_LIMIT = 5000

    def __init__(self, repo: AuditLogRepository) -> None:
        self._repo = repo

    def list_event_types(self) -> list[AuditLogEventTypeOption]:
        return [
            AuditLogEventTypeOption(value=key, label=label)
            for key, label in sorted(AUDIT_EVENT_LABELS.items(), key=lambda item: item[1])
        ]

    def list_events(
        self,
        *,
        page: int,
        page_size: int,
        event_type: str | None = None,
        actor_user_id: int | None = None,
        target_user_id: int | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        q: str | None = None,
    ) -> tuple[list[AuditLogEventResponse], int]:
        offset = (page - 1) * page_size
        rows = self._repo.list_events(
            limit=page_size,
            offset=offset,
            event_type=event_type,
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            from_date=from_date,
            to_date=to_date,
            q=q,
        )
        total = self._repo.count_events(
            event_type=event_type,
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            from_date=from_date,
            to_date=to_date,
            q=q,
        )
        return [_to_response(row) for row in rows], total

    def export_csv(
        self,
        *,
        event_type: str | None = None,
        actor_user_id: int | None = None,
        target_user_id: int | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        q: str | None = None,
    ) -> str:
        rows, _ = self.list_events(
            page=1,
            page_size=self.EXPORT_LIMIT,
            event_type=event_type,
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            from_date=from_date,
            to_date=to_date,
            q=q,
        )
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "event_id",
                "created_at",
                "event_type",
                "event_label",
                "actor_user_id",
                "actor_name",
                "actor_email",
                "target_user_id",
                "target_name",
                "target_email",
                "resource_type",
                "resource_id",
                "detail",
                "ip_address",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row.event_id,
                    row.created_at.isoformat() if row.created_at else "",
                    row.event_type,
                    row.event_label,
                    row.actor_user_id or "",
                    row.actor_name or "",
                    row.actor_email or "",
                    row.target_user_id or "",
                    row.target_name or "",
                    row.target_email or "",
                    row.resource_type or "",
                    row.resource_id or "",
                    row.detail or "",
                    row.ip_address or "",
                ]
            )
        return buffer.getvalue()
