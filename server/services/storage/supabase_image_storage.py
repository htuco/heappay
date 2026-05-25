from __future__ import annotations

import uuid
from dataclasses import dataclass

import httpx

from settings import Settings

_MAX_IMAGE_BYTES = 5 * 1024 * 1024
_ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


@dataclass(frozen=True)
class UploadedObject:
    """Storage object identity plus public URL."""

    path: str
    url: str


class SupabaseImageStorageService:
    """Upload images to Supabase Storage using the service role (server-side only)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def upload_user_image(self, user_id: int, data: bytes, content_type: str) -> UploadedObject:
        if len(data) > _MAX_IMAGE_BYTES:
            raise ValueError("FILE_TOO_LARGE")

        ct = (content_type or "").split(";")[0].strip().lower()
        ext = _ALLOWED_TYPES.get(ct)
        if ext is None:
            raise ValueError("UNSUPPORTED_IMAGE_TYPE")

        base = (self._settings.supabase_url or "").rstrip("/")
        bucket = self._settings.supabase_storage_bucket.strip()
        if not base or not bucket:
            raise ValueError("STORAGE_NOT_CONFIGURED")

        key = f"{user_id}/{uuid.uuid4().hex}.{ext}"
        upload_url = f"{base}/storage/v1/object/{bucket}/{key}"

        headers = {
            "Authorization": f"Bearer {self._settings.supabase_service_role_key}",
            "apikey": self._settings.supabase_service_role_key or "",
            "Content-Type": ct,
            "x-upsert": "true",
        }

        with httpx.Client(timeout=60.0) as client:
            response = client.post(upload_url, content=data, headers=headers)

        if response.status_code >= 400:
            raise ValueError("STORAGE_UPLOAD_FAILED")

        public_url = f"{base}/storage/v1/object/public/{bucket}/{key}"
        return UploadedObject(path=key, url=public_url)

    def delete_object_by_path(self, object_path: str) -> None:
        """Remove a single object from the configured bucket (best-effort)."""
        from services.storage.avatar_display_url import delete_supabase_objects

        path = (object_path or "").strip()
        if not path:
            return
        delete_supabase_objects([path], self._settings)
