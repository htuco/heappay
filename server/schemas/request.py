from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RefundRequestCreate(BaseModel):
    transaction_id: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=255)


class RefundRequestDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    transaction_id: int


class RequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    request_type_id: int
    request_status_id: int
    requester_user_id: int
    target_user_id: int | None
    note: str | None
    created_at: datetime
    resolved_at: datetime | None
    refund_detail: RefundRequestDetailResponse | None
