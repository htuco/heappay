from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class TransactionPartyResponse(BaseModel):
    card_id: int
    last_four: str
    cardholder_name: str | None
    user_id: int
    full_name: str | None
    email: str | None


class TransactionCreate(BaseModel):
    sender_card_id: int | None = Field(default=None, gt=0)
    recipient_card_id: int = Field(gt=0)
    transaction_type_id: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    note: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_sender_recipient_distinct(self) -> "TransactionCreate":
        if (
            self.sender_card_id is not None
            and self.sender_card_id == self.recipient_card_id
        ):
            raise ValueError("sender_card_id must differ from recipient_card_id")
        return self


class TransactionPatch(BaseModel):
    status_id: int | None = Field(default=None, gt=0)
    note: str | None = Field(default=None, max_length=255)


class TransactionSummaryPoint(BaseModel):
    period: str  # "YYYY-MM"
    income: Decimal
    expense: Decimal

    @computed_field  # type: ignore[prop-decorator]
    @property
    def net(self) -> Decimal:
        return self.income - self.expense


class TransactionSummaryResponse(BaseModel):
    points: list[TransactionSummaryPoint]
    months: int


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    sender_card_id: int | None
    recipient_card_id: int
    transaction_type_id: int
    status_id: int
    amount: Decimal
    note: str | None
    created_at: datetime
    has_pending_refund: bool = False
    sender: TransactionPartyResponse | None = None
    recipient: TransactionPartyResponse | None = None

    @model_validator(mode="before")
    @classmethod
    def populate_has_pending_refund(cls, values):
        detail = getattr(values, "refund_detail", None)
        if detail is not None:
            request = getattr(detail, "request", None)
            if request is not None and getattr(request, "request_status_id", None) == 1:
                values.__dict__["has_pending_refund"] = True
        return values
