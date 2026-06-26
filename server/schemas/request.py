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
    transaction_amount_hidden: bool = False
    transaction_note: str | None = None
    sender_name: str | None = None
    recipient_name: str | None = None


class CardFreezeRequestCreate(BaseModel):
    card_id: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=255)


class CardFreezeRequestDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    card_id: int
    card_last_four: str | None = None
    cardholder_name: str | None = None


class RequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    request_type_id: int
    request_type_name: str | None = None
    request_status_id: int
    requester_user_id: int
    requester_name: str | None = None
    target_user_id: int | None
    note: str | None
    created_at: datetime
    resolved_at: datetime | None
    refund_detail: RefundRequestDetailResponse | None
    card_freeze_detail: CardFreezeRequestDetailResponse | None = None


class RequestStatsResponse(BaseModel):
    pending: int
    approved: int
    declined: int
    cancelled: int
    total: int
