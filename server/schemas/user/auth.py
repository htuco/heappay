from datetime import datetime
from typing import Annotated

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


PasswordStr = Annotated[str, Field(min_length=8, max_length=255)]


class RegisterRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: PasswordStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: PasswordStr


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: PasswordStr
    confirm_password: PasswordStr

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class AcceptInvitationRequest(BaseModel):
    """Set password for invited users (no current password)."""

    new_password: PasswordStr
    confirm_password: PasswordStr

    @model_validator(mode="after")
    def passwords_match(self) -> "AcceptInvitationRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class DeactivateAccountRequest(BaseModel):
    current_password: str = Field(min_length=1)


class ProfileUpdateRequest(BaseModel):
    email: EmailStr | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=2048)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
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
    def require_at_least_one_field(self) -> "ProfileUpdateRequest":
        if (
            self.email is None
            and self.first_name is None
            and self.last_name is None
            and self.avatar_url is None
        ):
            raise ValueError("At least one field must be provided for update")
        return self


class NotificationPreferencesUpdate(BaseModel):
    billing_reminders_enabled: bool


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(validation_alias=AliasChoices("id", "user_id"))
    email: EmailStr
    first_name: str
    last_name: str
    created_at: datetime
    status_id: int
    user_role_id: int
    role_name: str
    billing_reminders_enabled: bool = True
    avatar_url: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


class AuthResponse(BaseModel):
    success: bool
    message: str
    data: TokenResponse | None = None
