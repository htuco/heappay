from datetime import datetime

from pydantic import BaseModel, Field


class AuditLogEventResponse(BaseModel):
    event_id: int
    event_type: str
    event_label: str
    actor_user_id: int | None = None
    actor_name: str | None = None
    actor_email: str | None = None
    target_user_id: int | None = None
    target_name: str | None = None
    target_email: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    detail: str | None = None
    ip_address: str | None = None
    created_at: datetime


class AuditLogEventTypeOption(BaseModel):
    value: str
    label: str


class AuditLogListQuery(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    event_type: str | None = None
    actor_user_id: int | None = Field(default=None, ge=1)
    target_user_id: int | None = Field(default=None, ge=1)
    from_date: datetime | None = None
    to_date: datetime | None = None
    q: str | None = Field(default=None, max_length=200)
