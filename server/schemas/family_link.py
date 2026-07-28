from datetime import datetime

from pydantic import BaseModel, EmailStr


class FamilyLinkInviteCreate(BaseModel):
    dependent_email: EmailStr


class FamilyLinkPartySummary(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: EmailStr
    avatar_url: str | None = None


class FamilyLinkResponse(BaseModel):
    family_link_id: int
    status: str
    guardian: FamilyLinkPartySummary
    dependent: FamilyLinkPartySummary
    invited_at: datetime
    responded_at: datetime | None = None
