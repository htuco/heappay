from pydantic import BaseModel


class ImageUploadPayload(BaseModel):
    url: str
    path: str
