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
    recovery_email_verify_url: str = "http://localhost:5173/verify-recovery-email"
    recovery_email_token_expire_hours: int = 24

    # hCaptcha bot protection. Verification is disabled until a secret key is set.
    hcaptcha_secret_key: str = ""
    hcaptcha_verify_url: str = "https://api.hcaptcha.com/siteverify"

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
    gemini_api_key: str = ""

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
    tx_duplicate_window_seconds: int = 90
    # In-app approval (step-up) before settling sensitive / online payments.
    tx_user_approval_above_amount: Decimal = Decimal("100.00")
    tx_user_approval_timeout_minutes: int = 15
    # Comma-separated transaction type names that always require user approval (e.g. fines).
    tx_user_approval_type_names: str = "fine"

    # TOTP 2FA — Fernet key for encrypting totp_secret at rest
    totp_encryption_key: str = ""

    # WebAuthn biometric enrollment.
    webauthn_rp_id: str = "localhost"
    webauthn_rp_name: str = "Heap"
    webauthn_origins: str = "http://localhost:5173"
    webauthn_registration_challenge_expire_minutes: int = 5

    # App PIN step-up for payment confirmation.
    app_pin_length: int = 4
    app_pin_max_failed_attempts: int = 5
    app_pin_lockout_minutes: int = 5

    # Indicative currency conversion for the AI assistant (informational only —
    # it never moves money). Live rates come from FX_API_URL (frankfurter.app,
    # keyless) with a short cache; FX_RATES is the offline fallback, quoted as
    # units of the base currency per 1 unit of the listed currency
    # (e.g. with base USD, "EUR:1.08" => 1 EUR = 1.08 USD).
    fx_api_url: str = "https://api.frankfurter.dev/v1"
    fx_base_currency: str = "USD"
    fx_rates: str = "EUR:1.08,GBP:1.27,CHF:1.12,JPY:0.0064,BAM:0.55"
    fx_cache_ttl_seconds: int = 3600

    # FEP Nexus funding integration (card top-ups via external treasury)
    nexus_url: str = ""
    nexus_secret_key: str = ""
    nexus_project: str = ""

    @computed_field
    @property
    def nexus_enabled(self) -> bool:
        return bool(
            self.nexus_url.strip()
            and self.nexus_secret_key.strip()
            and self.nexus_project.strip()
        )

    # Refund processor (phase 2 — disabled by default)
    refund_processor_enabled: bool = False
    refund_min_processing_delay_seconds: int = 3
    refund_auto_allow_max_amount: Decimal = Decimal("25.00")
    refund_max_age_days: int = 7

    @computed_field
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @computed_field
    @property
    def webauthn_origin_list(self) -> list[str]:
        return [o.strip() for o in self.webauthn_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
