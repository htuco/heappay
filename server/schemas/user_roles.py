from pydantic import BaseModel, ConfigDict, Field


class UserRoleBase(BaseModel):
    role_name: str = Field(min_length=1, max_length=100)


class UserRoleCreateRequest(UserRoleBase):
    pass


class UserRoleUpdateRequest(UserRoleBase):
    pass


class UserRoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_id: int
    role_name: str


class UserRoleDeleteResponse(BaseModel):
    message: str
