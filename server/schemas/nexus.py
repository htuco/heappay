from decimal import Decimal

from pydantic import BaseModel

from schemas.money import MoneyAmount


class FundRequestCreate(BaseModel):
    amount: MoneyAmount


class FundRequestResponse(BaseModel):
    id: str
    status: str
    amount: Decimal
    currency: str | None = None
    note: str | None = None
    external_ref: str | None = None
    project: str | None = None
    created_at: str | None = None
