from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _passes_luhn(number: str) -> bool:
    digits = [int(ch) for ch in number]
    checksum = 0
    parity = len(digits) % 2
    for idx, digit in enumerate(digits):
        if idx % 2 == parity:
            digit *= 2
            if digit > 9:
                digit -= 9
        checksum += digit
    return checksum % 10 == 0


def _validate_future_expiry(value: date) -> date:
    if value <= date.today():
        raise ValueError("expires_at must be a future date")
    return value


class CardCreate(BaseModel):
    user_id: int = Field(gt=0)
    status_id: int = Field(gt=0)
    card_type_id: int = Field(gt=0)
    card_numb: str = Field(min_length=13, max_length=19)
    cvc: str = Field(min_length=3, max_length=3)
    expires_at: date

    @field_validator("card_numb")
    @classmethod
    def validate_card_number(cls, value: str) -> str:
        number = value.strip()
        if not number.isdigit():
            raise ValueError("card_numb must contain digits only")
        if not _passes_luhn(number):
            raise ValueError("card_numb failed checksum validation")
        return number

    @field_validator("cvc")
    @classmethod
    def validate_cvc(cls, value: str) -> str:
        cvc = value.strip()
        if not cvc.isdigit():
            raise ValueError("cvc must contain digits only")
        if len(cvc) != 3:
            raise ValueError("cvc must be exactly 3 digits")
        return cvc

    @field_validator("expires_at")
    @classmethod
    def validate_expires_at(cls, value: date) -> date:
        return _validate_future_expiry(value)


class CardPatch(BaseModel):
    user_id: int | None = Field(default=None, gt=0)
    status_id: int | None = Field(default=None, gt=0)
    card_type_id: int | None = Field(default=None, gt=0)
    card_numb: str | None = Field(default=None, min_length=13, max_length=19)
    cvc: str | None = Field(default=None, min_length=3, max_length=3)
    expires_at: date | None = None
    balance: Decimal | None = Field(default=None, ge=0)

    @field_validator("card_numb")
    @classmethod
    def validate_card_number(cls, value: str | None) -> str | None:
        if value is None:
            return value
        number = value.strip()
        if not number.isdigit():
            raise ValueError("card_numb must contain digits only")
        if not _passes_luhn(number):
            raise ValueError("card_numb failed checksum validation")
        return number

    @field_validator("cvc")
    @classmethod
    def validate_cvc(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cvc = value.strip()
        if not cvc.isdigit():
            raise ValueError("cvc must contain digits only")
        if len(cvc) != 3:
            raise ValueError("cvc must be exactly 3 digits")
        return cvc

    @field_validator("expires_at")
    @classmethod
    def validate_expires_at(cls, value: date | None) -> date | None:
        if value is None:
            return value
        return _validate_future_expiry(value)


class CardLookupResponse(BaseModel):
    card_id: int
    last_four: str
    masked_card_number: str
    owner_name: str
    owner_email: str
    user_id: int


class CardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    card_id: int
    user_id: int
    status_id: int
    card_type_id: int
    last_four: str
    masked_card_number: str
    expires_at: date
    balance: Decimal
    created_at: datetime
    deleted_at: datetime | None = None
