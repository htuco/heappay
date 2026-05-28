"""Resolve stored Supabase *public* object URLs for clients; delete managed avatar objects."""

from __future__ import annotations

from functools import lru_cache

from settings import Settings


@lru_cache(maxsize=4)
def _supabase_client(supabase_url: str, service_role_key: str):
    from supabase import create_client

    return create_client(supabase_url, service_role_key)


def object_key_from_public_avatar_url(avatar_url: str | None, settings: Settings) -> str | None:
    """If ``avatar_url`` is our public bucket URL, return the object key inside the bucket."""
    if not avatar_url or not settings.supabase_url or not settings.supabase_storage_bucket:
        return None
    base = settings.supabase_url.rstrip("/")
    bucket = settings.supabase_storage_bucket.strip()
    prefix = f"{base}/storage/v1/object/public/{bucket}/"
    if not avatar_url.startswith(prefix):
        return None
    return avatar_url[len(prefix) :]


def delete_supabase_objects(keys: list[str], settings: Settings) -> None:
    """Best-effort delete of object keys in the configured bucket (service role)."""
    if not keys or not settings.supabase_url or not settings.supabase_service_role_key:
        return
    bucket = settings.supabase_storage_bucket.strip()
    if not bucket:
        return
    try:
        client = _supabase_client(settings.supabase_url, settings.supabase_service_role_key)
        client.storage.from_(bucket).remove(keys)
    except Exception:
        pass


def delete_managed_avatar_for_user(
    previous_public_url: str | None,
    *,
    user_id: int,
    settings: Settings,
) -> None:
    """
    Remove a prior avatar object from Storage when it lives under this project's public URL
    and path starts with ``{user_id}/`` (same convention as uploads).
    """
    key = object_key_from_public_avatar_url(previous_public_url, settings)
    if not key or not key.startswith(f"{user_id}/"):
        return
    delete_supabase_objects([key], settings)


def resolve_avatar_url_for_client(avatar_url: str | None, settings: Settings) -> str | None:
    """
    For private buckets, ``/object/public/...`` URLs fail in the browser (no auth). The service
    role can mint a signed URL; the client uses that in ``<img src>`` instead.

    If signing fails or the URL is not a matching public object URL, the original is returned.
    """
    if not avatar_url or not settings.supabase_url or not settings.supabase_service_role_key:
        return avatar_url
    key = object_key_from_public_avatar_url(avatar_url, settings)
    if key is None:
        return avatar_url
    try:
        client = _supabase_client(settings.supabase_url, settings.supabase_service_role_key)
        bucket = settings.supabase_storage_bucket.strip()
        ttl = settings.supabase_avatar_signed_ttl_seconds
        res = client.storage.from_(bucket).create_signed_url(key, ttl)
        signed = res.get("signedURL") or res.get("signedUrl")
        return str(signed) if signed else avatar_url
    except Exception:
        return avatar_url
