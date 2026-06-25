from typing import Any

from pydantic import BaseModel, Field


class BiometricStatusResponse(BaseModel):
    enabled: bool
    credential_count: int


class BiometricRegistrationOptionsResponse(BaseModel):
    challenge_id: int
    public_key: dict[str, Any] = Field(alias="publicKey")


class BiometricRegistrationCompleteRequest(BaseModel):
    challenge_id: int
    credential: dict[str, Any]


class BiometricCredentialResponse(BaseModel):
    credential_id: str
    device_type: str | None = None
    backed_up: bool = False
