from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RefundApprovalRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    enabled: bool
    max_age_days: int
    updated_at: datetime
    updated_by_user_id: int | None = None
    updated_by_name: str | None = None


class RefundApprovalRuleUpdate(BaseModel):
    enabled: bool
    max_age_days: int = Field(ge=1, le=365)
