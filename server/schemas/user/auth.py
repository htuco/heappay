from datetime import datetime
from typing import Annotated

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field


PasswordStr = Annotated[str, Field(min_length=8, max_length=255)]


class RegisterRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: PasswordStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: PasswordStr


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(validation_alias=AliasChoices("id", "user_id"))
    email: EmailStr
    first_name: str
    last_name: str
    created_at: datetime


class TokenResponse(BaseModel):
    refresh_token: str
    token_type: str
    user: UserResponse


class AuthResponse(BaseModel):
    success: bool
    message: str
    data: TokenResponse | None = None
