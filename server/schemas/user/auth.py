from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from utils.password_policy import StrongPasswordStr

LoginPasswordStr = Annotated[str, Field(min_length=1, max_length=255)]
PasswordStr = Annotated[str, Field(min_length=8, max_length=255)]


class RegisterRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: StrongPasswordStr
    hcaptcha_token: str | None = Field(default=None, min_length=1, max_length=4096)


class LoginRequest(BaseModel):
    email: EmailStr
    password: LoginPasswordStr
    hcaptcha_token: str | None = Field(default=None, min_length=1, max_length=4096)


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: StrongPasswordStr
    confirm_password: StrongPasswordStr

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class PasswordResetRequest(BaseModel):
    email: EmailStr
    hcaptcha_token: str | None = Field(default=None, min_length=1, max_length=4096)


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=32, max_length=512)
    new_password: StrongPasswordStr
    confirm_password: StrongPasswordStr

    @model_validator(mode="after")
    def passwords_match(self) -> "PasswordResetConfirmRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class AcceptInvitationRequest(BaseModel):
    """Set password for invited users (no current password)."""

    new_password: PasswordStr
    confirm_password: PasswordStr

    @model_validator(mode="after")
    def passwords_match(self) -> "AcceptInvitationRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class DeactivateAccountRequest(BaseModel):
    current_password: str = Field(min_length=1)


class AppPinStatusResponse(BaseModel):
    enabled: bool
    locked: bool = False
    locked_until: datetime | None = None
    failed_attempts_remaining: int | None = None


class AppPinSetRequest(BaseModel):
    current_password: str = Field(min_length=1)
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    confirm_pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")

    @model_validator(mode="after")
    def pins_match(self) -> "AppPinSetRequest":
        if self.pin != self.confirm_pin:
            raise ValueError("PINs do not match.")
        return self


class AppPinChangeRequest(BaseModel):
    current_pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    new_pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    confirm_pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")

    @model_validator(mode="after")
    def pins_match(self) -> "AppPinChangeRequest":
        if self.new_pin != self.confirm_pin:
            raise ValueError("PINs do not match.")
        if self.current_pin == self.new_pin:
            raise ValueError("New PIN must be different from the current PIN.")
        return self


class AppPinDisableRequest(BaseModel):
    current_pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class ProfileUpdateRequest(BaseModel):
    email: EmailStr | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=2048)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("value cannot be empty or whitespace only")
        return stripped

    @field_validator("avatar_url")
    @classmethod
    def normalize_avatar_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("avatar_url cannot be empty or whitespace only")
        if not stripped.lower().startswith("https://"):
            raise ValueError("avatar_url must be an https URL")
        return stripped

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "ProfileUpdateRequest":
        if (
            self.email is None
            and self.first_name is None
            and self.last_name is None
            and self.avatar_url is None
        ):
            raise ValueError("At least one field must be provided for update")
        return self


class PaymentSecurityPreferencesUpdate(BaseModel):
    payment_confirm_enabled: bool | None = None
    payment_confirm_above_amount: Decimal | None = Field(default=None, ge=0, le=Decimal("500000"))

    @model_validator(mode="after")
    def at_least_one_field(self) -> "PaymentSecurityPreferencesUpdate":
        if self.payment_confirm_enabled is None and self.payment_confirm_above_amount is None:
            raise ValueError("At least one preference must be provided.")
        return self


class NotificationPreferencesUpdate(BaseModel):
    billing_reminders_enabled: bool | None = None
    email_payment_sent_enabled: bool | None = None
    email_payment_received_enabled: bool | None = None
    email_topup_enabled: bool | None = None
    email_refund_status_enabled: bool | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "NotificationPreferencesUpdate":
        if not any(
            value is not None
            for value in (
                self.billing_reminders_enabled,
                self.email_payment_sent_enabled,
                self.email_payment_received_enabled,
                self.email_topup_enabled,
                self.email_refund_status_enabled,
            )
        ):
            raise ValueError("At least one preference must be provided.")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(validation_alias=AliasChoices("id", "user_id"))
    email: EmailStr
    first_name: str
    last_name: str
    created_at: datetime
    status_id: int
    user_role_id: int
    role_name: str
    billing_reminders_enabled: bool = True
    email_payment_sent_enabled: bool = True
    email_payment_received_enabled: bool = True
    email_topup_enabled: bool = True
    email_refund_status_enabled: bool = True
    avatar_url: str | None = None
    totp_enabled: bool = False
    payment_confirm_enabled: bool = True
    payment_confirm_above_amount: Decimal = Decimal("0")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


class TotpRequiredResponse(BaseModel):
    """Returned by /login when the account has 2FA enabled. Frontend must follow up with /auth/totp/verify."""
    requires_totp: bool = True
    partial_token: str


class TotpLoginResponse(BaseModel):
    success: bool
    message: str
    data: TokenResponse | TotpRequiredResponse | None = None


class TotpVerifyRequest(BaseModel):
    """Second step of login — exchange partial_token + 6-digit code for real JWT tokens."""
    partial_token: str
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class TotpSetupResponse(BaseModel):
    """Returned when user initiates 2FA setup — contains URI for QR code and plain secret for manual entry."""
    uri: str
    secret: str


class AuthResponse(BaseModel):
    success: bool
    message: str
    data: TokenResponse | TotpSetupResponse | None = None


class TotpConfirmRequest(BaseModel):
    """Confirm 2FA setup — user scans QR and sends first code to prove the app works."""
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class TotpDisableRequest(BaseModel):
    """Disable 2FA — requires current TOTP code to prevent disabling via stolen password alone."""
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
