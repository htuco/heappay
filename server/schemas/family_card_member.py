from datetime import datetime

from pydantic import BaseModel, EmailStr


class FamilyCardMemberCreate(BaseModel):
    dependent_user_id: int


class FamilyCardMemberResponse(BaseModel):
    family_card_member_id: int
    card_id: int
    dependent_user_id: int
    first_name: str
    last_name: str
    email: EmailStr
    avatar_url: str | None = None
    added_by_user_id: int
    added_at: datetime
