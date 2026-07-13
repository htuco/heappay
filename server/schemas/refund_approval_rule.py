from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class RefundApprovalRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    enabled: bool
    auto_approve_max_amount: Decimal
    max_age_days: int
    updated_at: datetime
    updated_by_user_id: int | None = None
    updated_by_name: str | None = None


class RefundApprovalRuleUpdate(BaseModel):
    enabled: bool
    auto_approve_max_amount: Decimal = Field(ge=0)
    max_age_days: int = Field(ge=1, le=365)
