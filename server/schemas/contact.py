from datetime import datetime

from pydantic import BaseModel, EmailStr

from schemas.user.crud import UserSearchDefaultCard


class ContactCreate(BaseModel):
    contact_user_id: int
    alias: str | None = None


class ContactUpdate(BaseModel):
    alias: str | None = None
    is_favorite: bool | None = None


class ContactResponse(BaseModel):
    contact_id: int
    user_id: int
    first_name: str
    last_name: str
    email: EmailStr
    avatar_url: str | None = None
    alias: str | None = None
    display_name: str
    is_favorite: bool
    default_card: UserSearchDefaultCard | None = None
    created_at: datetime
