from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

from schemas.money import MoneyAmount

SpendingLimitPeriod = Literal["daily", "weekly", "monthly"]


class SpendingLimitRuleCreate(BaseModel):
    category_id: int | None = None
    period: SpendingLimitPeriod
    max_amount: MoneyAmount
    requires_approval_above: Decimal | None = None
    requires_approval_always: bool = False
    enabled: bool = True


class SpendingLimitRuleUpdate(BaseModel):
    category_id: int | None = None
    period: SpendingLimitPeriod | None = None
    max_amount: MoneyAmount | None = None
    requires_approval_above: Decimal | None = None
    requires_approval_always: bool | None = None
    enabled: bool | None = None


class SpendingLimitRuleResponse(BaseModel):
    spending_limit_rule_id: int
    dependent_user_id: int | None = None
    card_id: int | None = None
    category_id: int | None = None
    period: SpendingLimitPeriod
    max_amount: Decimal
    requires_approval_above: Decimal | None = None
    requires_approval_always: bool
    enabled: bool
    updated_by_user_id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
