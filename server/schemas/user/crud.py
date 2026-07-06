from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from utils.person_name import PersonNameStr, validate_person_name

PasswordStr = Annotated[str, Field(min_length=8, max_length=255)]


class UserCreateRequest(BaseModel):
    email: EmailStr
    first_name: PersonNameStr
    last_name: PersonNameStr
    password: PasswordStr
    address: str | None = Field(default=None, max_length=255)
    status_id: int = Field(ge=1)
    user_role_id: int = Field(ge=1)

    @field_validator("address")
    @classmethod
    def strip_address(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("value cannot be empty or whitespace only")
        return stripped


class UserUpdateRequest(BaseModel):
    email: EmailStr | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    password: PasswordStr | None = None
    address: str | None = Field(default=None, max_length=255)
    status_id: int | None = Field(default=None, ge=1)
    user_role_id: int | None = Field(default=None, ge=1)
    avatar_url: str | None = Field(default=None, max_length=2048)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def validate_name_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Name must be a string.")
        return validate_person_name(value)

    @field_validator("address")
    @classmethod
    def strip_address(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("value cannot be empty or whitespace only")
        return stripped

    @field_validator("avatar_url")
    @classmethod
    def normalize_avatar_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("avatar_url cannot be empty or whitespace only")
        if not stripped.lower().startswith("https://"):
            raise ValueError("avatar_url must be an https URL")
        return stripped

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "UserUpdateRequest":
        if (
            self.email is None
            and self.first_name is None
            and self.last_name is None
            and self.password is None
            and self.address is None
            and self.status_id is None
            and self.user_role_id is None
            and self.avatar_url is None
        ):
            raise ValueError("At least one field must be provided for update")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    email: EmailStr
    first_name: str
    last_name: str
    address: str | None
    avatar_url: str | None = None
    status_id: int
    user_role_id: int
    created_at: datetime
    modified_at: datetime
    deleted_at: datetime | None


class UserSearchDefaultCard(BaseModel):
    card_id: int
    last_four: str
    vendor: str


class UserSearchResponse(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: EmailStr
    avatar_url: str | None = None
    default_card: UserSearchDefaultCard | None = None
