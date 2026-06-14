"""Resolve stored Supabase *public* object URLs for clients; delete managed avatar objects."""

from __future__ import annotations

import time
from functools import lru_cache
from threading import Lock

from settings import Settings


@lru_cache(maxsize=4)
def _supabase_client(supabase_url: str, service_role_key: str):
    from supabase import create_client

    return create_client(supabase_url, service_role_key)


# Cache of minted signed URLs, keyed by (bucket, object key). Signed URLs are valid for
# ``supabase_avatar_signed_ttl_seconds`` (7 days by default), so re-signing the same key on
# every list row is pure waste — a single transaction page would otherwise fire dozens of
# identical /object/sign requests. We hand back a cached URL until it nears expiry, then re-sign.
_SIGNED_URL_CACHE: dict[tuple[str, str], tuple[str, float]] = {}
_SIGNED_URL_CACHE_LOCK = Lock()

# Re-sign this many seconds before the URL actually expires, so we never return one that is
# about to die in the browser. Capped so short TTLs still get a sensible refresh window.
_SIGNED_URL_REFRESH_MARGIN_SECONDS = 60 * 60


def _cached_signed_url(bucket: str, key: str) -> str | None:
    cache_key = (bucket, key)
    with _SIGNED_URL_CACHE_LOCK:
        entry = _SIGNED_URL_CACHE.get(cache_key)
        if entry is not None and entry[1] > time.monotonic():
            return entry[0]
    return None


def _store_signed_url(bucket: str, key: str, signed: str, ttl_seconds: int) -> None:
    # Refresh well before the real expiry; for tiny TTLs fall back to half the lifetime.
    margin = min(_SIGNED_URL_REFRESH_MARGIN_SECONDS, ttl_seconds // 2)
    good_until = time.monotonic() + max(0, ttl_seconds - margin)
    with _SIGNED_URL_CACHE_LOCK:
        _SIGNED_URL_CACHE[(bucket, key)] = (signed, good_until)


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
    finally:
        # Drop any cached signed URLs for the removed objects so we never hand the client a
        # signed link to an object that no longer exists.
        with _SIGNED_URL_CACHE_LOCK:
            for key in keys:
                _SIGNED_URL_CACHE.pop((bucket, key), None)


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
    bucket = settings.supabase_storage_bucket.strip()
    cached = _cached_signed_url(bucket, key)
    if cached is not None:
        return cached
    try:
        client = _supabase_client(settings.supabase_url, settings.supabase_service_role_key)
        ttl = settings.supabase_avatar_signed_ttl_seconds
        res = client.storage.from_(bucket).create_signed_url(key, ttl)
        signed = res.get("signedURL") or res.get("signedUrl")
        if not signed:
            return avatar_url
        signed = str(signed)
        _store_signed_url(bucket, key, signed, ttl)
        return signed
    except Exception:
        return avatar_url
