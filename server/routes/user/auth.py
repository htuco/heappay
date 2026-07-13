from fastapi import APIRouter, Depends, File, HTTPException, Request, Security, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from ratelimit import AUTH_RATE_LIMIT, RECOVERY_EMAIL_RATE_LIMIT, limiter, user_id_key_func
from exceptions import InvalidInput, Unauthorized
from repositories.user.auth import UserAuthRepository
from routes.storage.deps import get_supabase_image_storage_service
from schemas.user.auth import (
    AcceptInvitationRequest,
    AppPinChangeRequest,
    AppPinDisableRequest,
    AppPinSetRequest,
    AppPinStatusResponse,
    AuthResponse,
    ChangePasswordRequest,
    DeactivateAccountRequest,
    LoginRequest,
    NotificationPreferencesUpdate,
    PaymentSecurityPreferencesUpdate,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    ProfileUpdateRequest,
    RecoveryEmailRemoveRequest,
    RecoveryEmailSetRequest,
    RecoveryEmailUpdateRequest,
    RecoveryEmailVerifyRequest,
    RefreshRequest,
    RegisterRequest,
    TotpConfirmRequest,
    TotpDisableRequest,
    TotpLoginResponse,
    TokenResponse,
    TotpVerifyRequest,
    VerifyEmailRequest,
)
from utils.audit_log import EVENT_LOGIN_FAILED, EVENT_LOGIN_SUCCESS, record_audit_log
from schemas.user.biometric import (
    BiometricAuthenticationOptionsResponse,
    BiometricCredentialResponse,
    BiometricDisableRequest,
    BiometricRegistrationCompleteRequest,
    BiometricRegistrationOptionsResponse,
    BiometricStatusResponse,
)
from services.storage.supabase_image_storage import SupabaseImageStorageService
from services.user.auth import UserAuthService
from utils.hcaptcha import HCAPTCHA_FAILURE_MESSAGE, verify_hcaptcha_token
from utils.login_attempts import (
    clear_failed_login_attempts,
    login_requires_hcaptcha,
    record_failed_login,
)
from utils.password_policy import is_password_policy_message
from utils.pwned_passwords import PASSWORD_PWNED_MESSAGE

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)


def get_auth_service(db: Session = Depends(get_db)) -> UserAuthService:
    return UserAuthService(UserAuthRepository(db))


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client is not None else None


def verify_auth_hcaptcha(request: Request, token: str | None) -> None:
    try:
        verify_hcaptcha_token(token, _client_ip(request))
    except ValueError:
        raise InvalidInput(HCAPTCHA_FAILURE_MESSAGE) from None


def verify_login_hcaptcha(request: Request, token: str | None, email: str) -> None:
    if not login_requires_hcaptcha(email, _client_ip(request)):
        return
    try:
        verify_hcaptcha_token(token, _client_ip(request))
    except ValueError:
        raise InvalidInput(
            HCAPTCHA_FAILURE_MESSAGE,
            code="HCAPTCHA_REQUIRED",
        ) from None


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_RATE_LIMIT)
def register(
    request: Request,
    payload: RegisterRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    verify_auth_hcaptcha(request, payload.hcaptcha_token)
    try:
        token_response = service.register(payload)
    except ValueError as exc:
        if str(exc) == PASSWORD_PWNED_MESSAGE:
            raise InvalidInput(PASSWORD_PWNED_MESSAGE) from None
        raise InvalidInput("An account with this email already exists.") from None

    return AuthResponse(success=True, message="Registration successful", data=token_response)


@router.post("/login", response_model=TotpLoginResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def login(
    request: Request,
    payload: LoginRequest,
    db: Session = Depends(get_db),
    service: UserAuthService = Depends(get_auth_service),
) -> TotpLoginResponse:
    client_ip = _client_ip(request)
    verify_login_hcaptcha(request, payload.hcaptcha_token, payload.email)
    try:
        result = service.login(payload)
    except ValueError:
        record_audit_log(
            db,
            event_type=EVENT_LOGIN_FAILED,
            detail=f"email={payload.email}",
            ip_address=client_ip,
        )
        attempts = record_failed_login(payload.email, client_ip)
        raise Unauthorized(
            "Invalid email or password.",
            details={
                "failed_login_attempts": attempts,
                "requires_hcaptcha": login_requires_hcaptcha(payload.email, client_ip),
            },
        ) from None

    clear_failed_login_attempts(payload.email, client_ip)
    if isinstance(result, TokenResponse):
        record_audit_log(
            db,
            event_type=EVENT_LOGIN_SUCCESS,
            actor_user_id=result.user.user_id,
            target_user_id=result.user.user_id,
            resource_type="user",
            resource_id=result.user.user_id,
            ip_address=client_ip,
        )
    return TotpLoginResponse(success=True, message="Login successful", data=result)


@router.post("/totp/verify", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def totp_verify(
    request: Request,
    payload: TotpVerifyRequest,
    db: Session = Depends(get_db),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    """Second step of 2FA login — exchange partial_token + 6-digit code for real JWT tokens."""
    client_ip = _client_ip(request)
    try:
        token_response = service.verify_totp_login(payload.partial_token, payload.code)
    except ValueError as exc:
        msg = str(exc)
        if msg == "INVALID_TOTP_CODE":
            raise Unauthorized("Invalid authentication code.") from None
        raise Unauthorized("Session expired. Please log in again.") from None

    record_audit_log(
        db,
        event_type=EVENT_LOGIN_SUCCESS,
        actor_user_id=token_response.user.user_id,
        target_user_id=token_response.user.user_id,
        resource_type="user",
        resource_id=token_response.user.user_id,
        ip_address=client_ip,
    )
    return AuthResponse(success=True, message="Login successful", data=token_response)


@router.post("/totp/setup", response_model=AuthResponse)
def totp_setup(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    """Generate a TOTP secret and return the QR URI. 2FA is not active until /totp/confirm."""
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    setup = service.setup_totp(user_id)
    return AuthResponse(success=True, message="Scan the QR code with your authenticator app.", data=setup)


@router.post("/totp/confirm", response_model=AuthResponse)
def totp_confirm(
    payload: TotpConfirmRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    """Confirm 2FA setup by verifying the first code from the authenticator app."""
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        service.confirm_totp_setup(user_id, payload.code)
    except ValueError as exc:
        msg = str(exc)
        if msg == "INVALID_TOTP_CODE":
            raise InvalidInput("Invalid code. Make sure your authenticator app is synced.") from None
        raise InvalidInput("Could not activate 2FA.") from None

    return AuthResponse(success=True, message="Two-factor authentication enabled.", data=None)


@router.delete("/totp", response_model=AuthResponse)
def totp_disable(
    payload: TotpDisableRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    """Disable 2FA — requires a valid current TOTP code."""
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        service.disable_totp(user_id, payload.code)
    except ValueError as exc:
        msg = str(exc)
        if msg == "INVALID_TOTP_CODE":
            raise InvalidInput("Invalid code.") from None
        if msg == "TOTP_NOT_ENABLED":
            raise InvalidInput("Two-factor authentication is not enabled.") from None
        raise InvalidInput("Could not disable 2FA.") from None

    return AuthResponse(success=True, message="Two-factor authentication disabled.", data=None)


@router.get("/biometrics", response_model=BiometricStatusResponse)
def biometric_status(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> BiometricStatusResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    return service.get_biometric_status(user_id)


@router.post(
    "/biometrics/registration/options",
    response_model=BiometricRegistrationOptionsResponse,
)
def biometric_registration_options(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> BiometricRegistrationOptionsResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        return service.begin_biometric_registration(user_id)
    except ValueError:
        raise InvalidInput("Could not start biometric enrollment.") from None


@router.post(
    "/biometrics/registration/complete",
    response_model=BiometricCredentialResponse,
)
def biometric_registration_complete(
    payload: BiometricRegistrationCompleteRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> BiometricCredentialResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        return service.complete_biometric_registration(user_id, payload)
    except ValueError as exc:
        message = str(exc)
        if message == "INVALID_OR_EXPIRED_BIOMETRIC_CHALLENGE":
            raise InvalidInput("Biometric enrollment expired. Try again.") from None
        if message == "BIOMETRIC_CREDENTIAL_ALREADY_EXISTS":
            raise InvalidInput("This biometric credential is already enrolled.") from None
        raise InvalidInput("Biometric enrollment failed. Try again.") from None


@router.post(
    "/biometrics/disable/options",
    response_model=BiometricAuthenticationOptionsResponse,
)
def biometric_disable_options(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> BiometricAuthenticationOptionsResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        return service.begin_biometric_disable(user_id)
    except ValueError as exc:
        if str(exc) == "BIOMETRIC_NOT_ENABLED":
            raise InvalidInput("Biometric authentication is not enabled.") from None
        raise InvalidInput("Could not start biometric verification.") from None


@router.post("/biometrics/disable/complete", response_model=BiometricStatusResponse)
def biometric_disable_complete(
    payload: BiometricDisableRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> BiometricStatusResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        return service.complete_biometric_disable(user_id, payload)
    except ValueError as exc:
        if str(exc) == "INVALID_OR_EXPIRED_BIOMETRIC_CHALLENGE":
            raise InvalidInput("Biometric verification expired. Try again.") from None
        raise InvalidInput("Biometric verification failed. Try again.") from None


@router.delete("/biometrics", response_model=BiometricStatusResponse)
def biometric_disable(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> BiometricStatusResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        return service.disable_biometric_authentication(user_id)
    except ValueError as exc:
        if str(exc) == "BIOMETRIC_VERIFICATION_REQUIRED":
            raise InvalidInput("Biometric verification is required to disable biometrics.") from None
        raise InvalidInput("Could not disable biometric authentication.") from None


@router.get("/app-pin", response_model=AppPinStatusResponse)
def app_pin_status(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AppPinStatusResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        return service.get_app_pin_status(user_id)
    except ValueError:
        raise InvalidInput("Could not load app PIN status.") from None


@router.post("/app-pin", response_model=AppPinStatusResponse)
def app_pin_set(
    payload: AppPinSetRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AppPinStatusResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        return service.set_app_pin(user_id, payload)
    except ValueError as exc:
        msg = str(exc)
        if msg == "APP_PIN_ALREADY_SET":
            raise InvalidInput("App PIN is already set. Change it instead.") from None
        if msg == "WRONG_CURRENT_PASSWORD":
            raise InvalidInput("Current password is incorrect.") from None
        raise InvalidInput("Could not set app PIN.") from None


@router.patch("/app-pin", response_model=AppPinStatusResponse)
def app_pin_change(
    payload: AppPinChangeRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AppPinStatusResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        return service.change_app_pin(user_id, payload)
    except ValueError as exc:
        msg = str(exc)
        if msg == "APP_PIN_NOT_SET":
            raise InvalidInput("Set an app PIN before changing it.") from None
        if msg == "APP_PIN_LOCKED":
            raise InvalidInput("App PIN is locked. Try again later.") from None
        if msg == "INVALID_APP_PIN":
            raise InvalidInput("Current app PIN is incorrect.") from None
        raise InvalidInput("Could not change app PIN.") from None


@router.delete("/app-pin", response_model=AppPinStatusResponse)
def app_pin_disable(
    payload: AppPinDisableRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AppPinStatusResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        return service.disable_app_pin(user_id, payload)
    except ValueError as exc:
        msg = str(exc)
        if msg == "APP_PIN_NOT_SET":
            raise InvalidInput("App PIN is not set.") from None
        if msg == "APP_PIN_LOCKED":
            raise InvalidInput("App PIN is locked. Try again later.") from None
        if msg == "INVALID_APP_PIN":
            raise InvalidInput("Current app PIN is incorrect.") from None
        raise InvalidInput("Could not disable app PIN.") from None


@router.post("/refresh", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def refresh(
    request: Request,
    payload: RefreshRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    token_data = service.refresh(payload.refresh_token)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return AuthResponse(success=True, message="Token refreshed", data=token_data)


@router.post("/logout", response_model=AuthResponse)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    success = service.logout(credentials.credentials)
    if not success:
        raise Unauthorized("Invalid or expired token.")

    return AuthResponse(success=True, message="Logged out successfully", data=None)


@router.post("/change-password", response_model=AuthResponse)
def change_password(
    payload: ChangePasswordRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        service.change_password(user_id, payload)
    except ValueError as exc:
        msg = str(exc)
        if msg == "WRONG_CURRENT_PASSWORD":
            raise InvalidInput("Current password is incorrect.") from None
        if is_password_policy_message(msg):
            raise InvalidInput(msg) from None
        if msg == PASSWORD_PWNED_MESSAGE:
            raise InvalidInput(PASSWORD_PWNED_MESSAGE) from None
        raise InvalidInput("Could not update password.") from None

    return AuthResponse(success=True, message="Password updated successfully.", data=None)


@router.post("/password-reset/request", response_model=AuthResponse)
def request_password_reset(
    request: Request,
    payload: PasswordResetRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    verify_auth_hcaptcha(request, payload.hcaptcha_token)
    try:
        service.request_password_reset(payload)
    except ValueError as exc:
        if str(exc) == "MAIL_DELIVERY_FAILED":
            raise InvalidInput("Could not send password reset email.") from None
        raise InvalidInput("Could not request password reset.") from None

    return AuthResponse(
        success=True,
        message="If an account exists for this email, a reset link has been sent.",
        data=None,
    )


@router.post("/password-reset/confirm", response_model=AuthResponse)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    try:
        service.confirm_password_reset(payload)
    except ValueError as exc:
        msg = str(exc)
        if is_password_policy_message(msg):
            raise InvalidInput(msg) from None
        if msg == PASSWORD_PWNED_MESSAGE:
            raise InvalidInput(PASSWORD_PWNED_MESSAGE) from None
        raise InvalidInput("Password reset link is invalid or expired.") from None

    return AuthResponse(success=True, message="Password reset successfully.", data=None)


@router.post("/verify-email", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def verify_email(
    request: Request,
    payload: VerifyEmailRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    try:
        service.verify_email(payload)
    except ValueError:
        raise InvalidInput("Verification link is invalid or expired.") from None

    return AuthResponse(success=True, message="Email verified successfully.", data=None)


@router.post("/verify-email/resend", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def resend_verification_email(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        service.resend_verification_email(user_id)
    except ValueError as exc:
        if str(exc) == "ALREADY_VERIFIED":
            raise InvalidInput("Your email is already verified.") from None
        raise InvalidInput("Could not resend verification email.") from None

    return AuthResponse(success=True, message="Verification email sent.", data=None)


@router.post("/accept-invitation", response_model=AuthResponse)
def accept_invitation(
    payload: AcceptInvitationRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        token_data = service.accept_invitation(
            user_id,
            payload,
            credentials.credentials,
        )
    except ValueError as exc:
        msg = str(exc)
        if msg == "NOT_INVITED":
            raise InvalidInput(
                "Only invited accounts can complete onboarding here.",
            ) from None
        if is_password_policy_message(msg):
            raise InvalidInput(msg) from None
        raise InvalidInput("Could not complete invitation.") from None

    return AuthResponse(
        success=True,
        message="Invitation accepted. Your account is now active.",
        data=token_data,
    )


@router.post("/deactivate", response_model=AuthResponse)
def deactivate(
    payload: DeactivateAccountRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

    try:
        service.deactivate_account(user_id, payload)
    except ValueError as exc:
        msg = str(exc)
        if msg == "WRONG_CURRENT_PASSWORD":
            raise InvalidInput("Current password is incorrect.") from None
        if msg == "ALREADY_DEACTIVATED":
            raise InvalidInput("Account is already deactivated.") from None
        raise InvalidInput("Could not deactivate account.") from None

    return AuthResponse(success=True, message="Account deactivated.", data=None)


@router.get("/me", response_model=AuthResponse)
def me(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    token_data = service.get_me(credentials.credentials)
    if token_data is None:
        raise Unauthorized("Invalid or expired token.")

    return AuthResponse(success=True, message="User profile retrieved", data=token_data)


@router.patch("/me", response_model=AuthResponse)
def update_me(
    payload: ProfileUpdateRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    try:
        token_data = service.update_profile(credentials.credentials, payload)
    except ValueError as exc:
        if str(exc) == "EMAIL_NOT_AVAILABLE":
            raise InvalidInput("An account with this email already exists.") from None
        raise InvalidInput("Could not update profile.") from None

    if token_data is None:
        raise Unauthorized("Invalid or expired token.")

    return AuthResponse(success=True, message="Profile updated successfully.", data=token_data)


@router.post("/me/avatar", response_model=AuthResponse)
def upload_me_avatar(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
    storage: SupabaseImageStorageService = Depends(get_supabase_image_storage_service),
) -> AuthResponse:
    """Upload a profile image to storage and set users.avatar_url in one step."""
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")

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

    try:
        token_data = service.update_profile(
            credentials.credentials,
            ProfileUpdateRequest(avatar_url=uploaded.url),
        )
    except ValueError:
        storage.delete_object_by_path(uploaded.path)
        raise InvalidInput("Could not update profile.") from None

    if token_data is None:
        storage.delete_object_by_path(uploaded.path)
        raise Unauthorized("Invalid or expired token.")

    return AuthResponse(success=True, message="Profile photo updated.", data=token_data)


@router.patch("/notification-preferences", response_model=AuthResponse)
def update_notification_preferences(
    payload: NotificationPreferencesUpdate,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    token_data = service.update_notification_preferences(
        credentials.credentials,
        payload,
    )
    if token_data is None:
        raise Unauthorized("Invalid or expired token.")

    return AuthResponse(
        success=True,
        message="Notification preferences updated.",
        data=token_data,
    )


@router.patch("/payment-security-preferences", response_model=AuthResponse)
def update_payment_security_preferences(
    payload: PaymentSecurityPreferencesUpdate,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    token_data = service.update_payment_security_preferences(
        credentials.credentials,
        payload,
    )
    if token_data is None:
        raise Unauthorized("Invalid or expired token.")

    return AuthResponse(
        success=True,
        message="Payment security preferences updated.",
        data=token_data,
    )


def _recovery_email_error(exc: ValueError) -> None:
    code = str(exc)
    messages = {
        "RECOVERY_EMAIL_SAME_AS_LOGIN": "Recovery email must be different from your login email.",
        "RECOVERY_EMAIL_UNAVAILABLE": "That email address is not available.",
        "RECOVERY_EMAIL_ALREADY_SET": "A recovery email is already set. Use change instead.",
        "RECOVERY_EMAIL_NOT_SET": "No recovery email is set on this account.",
        "RECOVERY_EMAIL_UNCHANGED": "Enter a different recovery email address.",
        "RECOVERY_EMAIL_NOT_PENDING": "No pending recovery email verification.",
        "MAIL_DELIVERY_FAILED": "Could not send verification email.",
        "INVALID_OR_EXPIRED_RECOVERY_TOKEN": "Verification link is invalid or has expired.",
        "WRONG_PASSWORD": "Current password is incorrect.",
        "INVALID_TOTP_CODE": "Invalid authenticator code.",
        "TOTP_REQUIRED": "Authenticator code is required to remove your recovery email.",
    }
    if code in messages:
        raise InvalidInput(messages[code]) from None
    raise InvalidInput("Could not update recovery email.") from None


@router.post("/recovery-email", response_model=AuthResponse)
@limiter.limit(RECOVERY_EMAIL_RATE_LIMIT, key_func=user_id_key_func)
def add_recovery_email(
    request: Request,
    payload: RecoveryEmailSetRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")
    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")
    try:
        service.add_recovery_email(user_id, payload)
    except ValueError as exc:
        _recovery_email_error(exc)

    token_data = service.get_me(credentials.credentials)
    return AuthResponse(
        success=True,
        message="Verification link sent to your recovery email.",
        data=token_data,
    )


@router.patch("/recovery-email", response_model=AuthResponse)
@limiter.limit(RECOVERY_EMAIL_RATE_LIMIT, key_func=user_id_key_func)
def change_recovery_email(
    request: Request,
    payload: RecoveryEmailUpdateRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")
    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")
    try:
        service.change_recovery_email(user_id, payload)
    except ValueError as exc:
        _recovery_email_error(exc)

    token_data = service.get_me(credentials.credentials)
    return AuthResponse(
        success=True,
        message="Verification link sent to your new recovery email.",
        data=token_data,
    )


@router.post("/recovery-email/resend", response_model=AuthResponse)
@limiter.limit(RECOVERY_EMAIL_RATE_LIMIT, key_func=user_id_key_func)
def resend_recovery_email_verification(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")
    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")
    try:
        service.resend_recovery_email_verification(user_id)
    except ValueError as exc:
        _recovery_email_error(exc)

    return AuthResponse(
        success=True,
        message="Verification link resent.",
        data=None,
    )


@router.post("/recovery-email/verify", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def verify_recovery_email(
    request: Request,
    payload: RecoveryEmailVerifyRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    try:
        service.verify_recovery_email(payload)
    except ValueError as exc:
        _recovery_email_error(exc)

    return AuthResponse(
        success=True,
        message="Recovery email verified.",
        data=None,
    )


@router.delete("/recovery-email", response_model=AuthResponse)
@limiter.limit(RECOVERY_EMAIL_RATE_LIMIT, key_func=user_id_key_func)
def remove_recovery_email(
    request: Request,
    payload: RecoveryEmailRemoveRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    if credentials is None:
        raise Unauthorized("Authorization header is required.")
    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")
    try:
        service.remove_recovery_email(user_id, payload)
    except ValueError as exc:
        _recovery_email_error(exc)

    token_data = service.get_me(credentials.credentials)
    return AuthResponse(
        success=True,
        message="Recovery email removed.",
        data=token_data,
    )
