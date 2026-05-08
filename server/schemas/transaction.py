from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
