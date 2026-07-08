from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from schemas.money import MoneyAmount

# "to_card": wallet -> card (fund a card). "to_wallet": card -> wallet (pull funds back).
TransferDirection = Literal["to_card", "to_wallet"]


class WalletBalanceResponse(BaseModel):
    wallet_balance: Decimal


class WalletTransferCreate(BaseModel):
    direction: TransferDirection
    card_id: int
    amount: MoneyAmount


class WalletTransferResponse(BaseModel):
    direction: TransferDirection
    card_id: int
    amount: Decimal
    wallet_balance: Decimal
