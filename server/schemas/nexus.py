from decimal import Decimal

from pydantic import BaseModel, Field


class FundRequestCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class FundRequestResponse(BaseModel):
    id: str
    status: str
    amount: Decimal
    currency: str | None = None
    note: str | None = None
    external_ref: str | None = None
    project: str | None = None
    created_at: str | None = None
