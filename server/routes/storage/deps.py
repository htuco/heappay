from exceptions import InvalidInput
from services.storage.supabase_image_storage import SupabaseImageStorageService
from settings import get_settings


def get_supabase_image_storage_service() -> SupabaseImageStorageService:
    """Dependency: Supabase-backed image storage, or 400 if not configured."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_role_key:
        raise InvalidInput(
            "File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )
    return SupabaseImageStorageService(s)
