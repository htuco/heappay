from datetime import date, datetime
from decimal import Decimal

from pydantic import AliasPath, BaseModel, ConfigDict, Field, field_validator, model_validator


class RecurringPaymentCreate(BaseModel):
    sender_card_id: int = Field(gt=0)
    recipient_card_id: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    day_of_month: int = Field(ge=1, le=31)
    months: list[int] | None = Field(default=None)
    note: str | None = Field(default=None, max_length=255)

    @field_validator("months")
    @classmethod
    def validate_months(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return None
        cleaned = sorted({m for m in v if 1 <= m <= 12})
        return cleaned if cleaned else None

    @model_validator(mode="after")
    def validate_cards_distinct(self) -> "RecurringPaymentCreate":
        if self.sender_card_id == self.recipient_card_id:
            raise ValueError("sender_card_id must differ from recipient_card_id")
        return self


class RecurringPaymentUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    months: list[int] | None = Field(default=None)
    note: str | None = Field(default=None, max_length=255)

    @field_validator("months")
    @classmethod
    def validate_months(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return None
        cleaned = sorted({m for m in v if 1 <= m <= 12})
        return cleaned if cleaned else None


class RecurringPaymentPartyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    card_id: int
    last_four: str | None
    cardholder_name: str | None
    brand: str | None = Field(default=None, validation_alias=AliasPath("card_type", "vendor"))
    email: str | None = Field(default=None, validation_alias=AliasPath("user", "email"))
    first_name: str | None = Field(default=None, validation_alias=AliasPath("user", "first_name"))
    last_name: str | None = Field(default=None, validation_alias=AliasPath("user", "last_name"))
    avatar_url: str | None = Field(default=None, validation_alias=AliasPath("user", "avatar_url"))


class RecurringPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recurring_payment_id: int
    user_id: int
    sender_card_id: int
    recipient_card_id: int
    amount: Decimal
    day_of_month: int
    months: list[int] | None = None
    note: str | None
    status: str
    next_due_at: date
    last_run_failed: bool
    last_run_error: str | None
    created_at: datetime
    cancelled_at: datetime | None
    sender: RecurringPaymentPartyResponse | None = Field(
        default=None, validation_alias=AliasPath("sender_card")
    )
    recipient: RecurringPaymentPartyResponse = Field(
        validation_alias=AliasPath("recipient_card")
    )

    @field_validator("months", mode="before")
    @classmethod
    def parse_months(cls, v: object) -> list[int] | None:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            return [int(m) for m in v.split(",") if m.strip()]
        return v
