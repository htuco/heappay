from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CardStatusCreate(BaseModel):
    status_name: str = Field(
        min_length=1, max_length=100, description="Unique status name"
    )

    @field_validator("status_name")
    @classmethod
    def strip_status_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("status_name cannot be empty or whitespace only")
        return s


class CardStatusUpdate(BaseModel):
    status_name: str = Field(
        min_length=1, max_length=100, description="New unique status name"
    )

    @field_validator("status_name")
    @classmethod
    def strip_status_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("status_name cannot be empty or whitespace only")
        return s


class CardStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    card_status_id: int
    status_name: str
    created_at: datetime
