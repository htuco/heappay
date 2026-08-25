from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from schemas.money import MoneyAmount
from schemas.transaction import BiometricApprovalAssertion

RefundReasonCode = Literal[
    "duplicate_payment",
    "wrong_recipient",
    "incorrect_amount",
    "not_delivered",
    "other",
]


class RefundRequestCreate(BaseModel):
    transaction_id: int = Field(gt=0)
    reason_code: RefundReasonCode
    note: str | None = Field(default=None, max_length=255)


class RefundRequestDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    transaction_id: int
    reason_code: str | None = None
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


class MoneyRequestCreate(BaseModel):
    target_user_id: int = Field(gt=0)
    amount: MoneyAmount
    note: str | None = Field(default=None, max_length=255)


class MoneyRequestDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    amount: Decimal
    settled_transaction_id: int | None = None
    requester_name: str | None = None
    target_name: str | None = None
    requires_user_approval: bool = False
    user_approval_expires_at: datetime | None = None


class MoneyRequestPay(BaseModel):
    """Payer step-up + source card for settling a money request."""

    sender_card_id: int = Field(gt=0)
    biometric: BiometricApprovalAssertion | None = None
    app_pin: str | None = Field(default=None, min_length=4, max_length=4, pattern=r"^\d{4}$")
    totp_code: str | None = Field(default=None, min_length=6, max_length=6)
    password: str | None = Field(default=None, min_length=1, max_length=255)

    @model_validator(mode="after")
    def validate_pay_request(self) -> "MoneyRequestPay":
        credentials = [self.biometric, self.app_pin, self.totp_code, self.password]
        provided = [credential for credential in credentials if credential]
        if len(provided) > 1:
            raise ValueError("Provide only one payment confirmation method.")
        return self


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
    money_request_detail: MoneyRequestDetailResponse | None = None


class RequestStatsResponse(BaseModel):
    pending: int
    approved: int
    declined: int
    cancelled: int
    total: int
