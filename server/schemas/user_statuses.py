from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserStatusBase(BaseModel):
    status_name: str


class UserStatusCreate(UserStatusBase):
    pass


class UserStatusUpdate(UserStatusBase):
    pass


class UserStatusRead(UserStatusBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class MessageResponse(BaseModel):
    message: str
