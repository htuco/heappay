from decimal import Decimal

from pydantic import BaseModel

from schemas.money import MoneyAmount


class AllowanceTransferCreate(BaseModel):
    amount: MoneyAmount


class AllowanceTransferResponse(BaseModel):
    dependent_user_id: int
    amount: Decimal
    guardian_wallet_balance: Decimal
    dependent_wallet_balance: Decimal
