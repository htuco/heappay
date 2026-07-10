from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from models.audit_log_event import AuditLogEvent


class AuditLogRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def append(
        self,
        *,
        event_type: str,
        actor_user_id: int | None = None,
        target_user_id: int | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        detail: str | None = None,
        ip_address: str | None = None,
    ) -> AuditLogEvent:
        row = AuditLogEvent(
            event_type=event_type,
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
            ip_address=ip_address,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def _base_stmt(
        self,
        *,
        event_type: str | None = None,
        actor_user_id: int | None = None,
        target_user_id: int | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        q: str | None = None,
    ):
        stmt = select(AuditLogEvent).options(
            joinedload(AuditLogEvent.actor),
            joinedload(AuditLogEvent.target),
        )
        if event_type:
            stmt = stmt.where(AuditLogEvent.event_type == event_type)
        if actor_user_id is not None:
            stmt = stmt.where(AuditLogEvent.actor_user_id == actor_user_id)
        if target_user_id is not None:
            stmt = stmt.where(AuditLogEvent.target_user_id == target_user_id)
        if from_date is not None:
            stmt = stmt.where(AuditLogEvent.created_at >= from_date)
        if to_date is not None:
            stmt = stmt.where(AuditLogEvent.created_at <= to_date)
        if q:
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(AuditLogEvent.detail.ilike(pattern))
        return stmt

    def list_events(
        self,
        *,
        limit: int,
        offset: int,
        event_type: str | None = None,
        actor_user_id: int | None = None,
        target_user_id: int | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        q: str | None = None,
    ) -> list[AuditLogEvent]:
        stmt = (
            self._base_stmt(
                event_type=event_type,
                actor_user_id=actor_user_id,
                target_user_id=target_user_id,
                from_date=from_date,
                to_date=to_date,
                q=q,
            )
            .order_by(AuditLogEvent.created_at.desc(), AuditLogEvent.event_id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self._db.scalars(stmt).unique().all())

    def count_events(
        self,
        *,
        event_type: str | None = None,
        actor_user_id: int | None = None,
        target_user_id: int | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        q: str | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(AuditLogEvent)
        if event_type:
            stmt = stmt.where(AuditLogEvent.event_type == event_type)
        if actor_user_id is not None:
            stmt = stmt.where(AuditLogEvent.actor_user_id == actor_user_id)
        if target_user_id is not None:
            stmt = stmt.where(AuditLogEvent.target_user_id == target_user_id)
        if from_date is not None:
            stmt = stmt.where(AuditLogEvent.created_at >= from_date)
        if to_date is not None:
            stmt = stmt.where(AuditLogEvent.created_at <= to_date)
        if q:
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(AuditLogEvent.detail.ilike(pattern))
        return int(self._db.scalar(stmt) or 0)
