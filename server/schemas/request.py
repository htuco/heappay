from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class RefundRequestCreate(BaseModel):
    transaction_id: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=255)


class RefundRequestDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    transaction_id: int
    transaction_amount: Decimal | None = None
    transaction_note: str | None = None
    sender_name: str | None = None
    recipient_name: str | None = None


class RequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    request_type_id: int
    request_status_id: int
    requester_user_id: int
    requester_name: str | None = None
    target_user_id: int | None
    note: str | None
    created_at: datetime
    resolved_at: datetime | None
    refund_detail: RefundRequestDetailResponse | None
