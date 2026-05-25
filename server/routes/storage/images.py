from fastapi import APIRouter, Depends, File, UploadFile

from exceptions import InvalidInput
from routes.dependencies import get_current_user_id
from routes.storage.deps import get_supabase_image_storage_service
from schemas.response import ApiResponse
from schemas.storage import ImageUploadPayload
from services.storage.supabase_image_storage import SupabaseImageStorageService

router = APIRouter(prefix="/storage", tags=["storage"])


@router.post("/images", response_model=ApiResponse[ImageUploadPayload])
def upload_image(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    storage: SupabaseImageStorageService = Depends(get_supabase_image_storage_service),
) -> ApiResponse[ImageUploadPayload]:
    """Authenticated upload of a single image; returns a public object URL."""
    raw = file.file.read()
    if not raw:
        raise InvalidInput("Empty file.")

    try:
        uploaded = storage.upload_user_image(user_id, raw, file.content_type or "")
    except ValueError as exc:
        code = str(exc)
        if code == "FILE_TOO_LARGE":
            raise InvalidInput("Image must be 5 MB or smaller.") from None
        if code == "UNSUPPORTED_IMAGE_TYPE":
            raise InvalidInput("Only JPEG, PNG, and WebP images are allowed.") from None
        if code in ("STORAGE_NOT_CONFIGURED", "STORAGE_UPLOAD_FAILED"):
            raise InvalidInput("Could not store the image. Try again later.") from None
        raise InvalidInput("Could not store the image.") from None

    return ApiResponse[ImageUploadPayload](
        success=True,
        message="Image uploaded.",
        data=ImageUploadPayload(url=uploaded.url, path=uploaded.path),
    )
