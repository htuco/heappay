from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserStatusBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Maps to user_statuses.status_name.",
    )


class UserStatusCreate(UserStatusBase):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"example": {"status_name": "pending_review"}},
    )


class UserStatusUpdate(UserStatusBase):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"example": {"status_name": "active"}},
    )


class UserStatusRead(UserStatusBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class MessageResponse(BaseModel):
    message: str
