from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CardTypeCreate(BaseModel):
    type_name: str = Field(
        min_length=1, max_length=100, description="Card type name (e.g. debit)"
    )
    vendor: str = Field(
        min_length=1, max_length=100, description="Card vendor (e.g. visa)"
    )

    @field_validator("type_name", "vendor")
    @classmethod
    def strip_fields(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("value cannot be empty or whitespace only")
        return s


class CardTypeUpdate(BaseModel):
    type_name: str | None = Field(
        default=None, min_length=1, max_length=100, description="New card type name"
    )
    vendor: str | None = Field(
        default=None, min_length=1, max_length=100, description="New card vendor"
    )

    @field_validator("type_name", "vendor")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s:
            raise ValueError("value cannot be empty or whitespace only")
        return s

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "CardTypeUpdate":
        if self.type_name is None and self.vendor is None:
            raise ValueError("At least one field must be provided for update")
        return self


class CardTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    card_type_id: int
    type_name: str
    vendor: str
    created_at: datetime
