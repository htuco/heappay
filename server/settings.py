from decimal import Decimal
from functools import lru_cache
from typing import Literal

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str
    port: int
    reload: bool
    database_url: str
    cors_origins: str
    forwarded_allow_ips: str | None = None
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    password_reset_token_expire_minutes: int = 30
    password_reset_url: str = "http://localhost:5173/reset-password"

    # Optional SMTP mail delivery for password reset links.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    mail_from: str = "no-reply@heap.local"
    groq_api_key: str = ""
    supabase_database_url: str = ""
    cohere_api_key: str = ""

    # Supabase Storage (optional — required for /storage/images and POST /auth/me/avatar)
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_storage_bucket: str = "uploads"
    # Signed URLs for avatars (private buckets). Ignored if Supabase env is unset.
    supabase_avatar_signed_ttl_seconds: int = 60 * 60 * 24 * 7

    # Transaction processor (cron job + in-app scheduler)
    tx_processor_scheduler_enabled: bool = True
    tx_processor_interval_seconds: int = 60
    tx_processor_batch_size: int = 100
    card_expiration_batch_size: int = 100
    tx_min_processing_delay_seconds: int = 3
    # Amounts above this stay pending for staff; everything else auto-allows if rules pass.
    tx_manual_review_above_amount: Decimal = Decimal("500000.00")
    tx_pending_max_age_minutes: int = 1440
    tx_pending_timeout_action: Literal["allow", "deny"] = "deny"
    tx_staff_bypass_delay: bool = False

    # TOTP 2FA — Fernet key for encrypting totp_secret at rest
    totp_encryption_key: str = ""

    # Refund processor (phase 2 — disabled by default)
    refund_processor_enabled: bool = False
    refund_min_processing_delay_seconds: int = 3
    refund_auto_allow_max_amount: Decimal = Decimal("25.00")
    refund_max_age_days: int = 7

    @computed_field
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
