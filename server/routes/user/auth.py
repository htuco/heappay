from fastapi import APIRouter, Depends, File, HTTPException, Request, Security, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from ratelimit import AUTH_RATE_LIMIT, limiter
from exceptions import InvalidInput, Unauthorized
from repositories.user.auth import UserAuthRepository
from routes.storage.deps import get_supabase_image_storage_service
from schemas.user.auth import (
    AcceptInvitationRequest,
    AuthResponse,
    ChangePasswordRequest,
    DeactivateAccountRequest,
    LoginRequest,
    NotificationPreferencesUpdate,
    ProfileUpdateRequest,
    RefreshRequest,
    RegisterRequest,
)
from services.storage.supabase_image_storage import SupabaseImageStorageService
from services.user.auth import UserAuthService

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)


def get_auth_service(db: Session = Depends(get_db)) -> UserAuthService:
    return UserAuthService(UserAuthRepository(db))


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_RATE_LIMIT)
def register(
    request: Request,
    payload: RegisterRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    try:
        token_response = service.register(payload)
    except ValueError:
        raise InvalidInput("An account with this email already exists.") from None

    return AuthResponse(success=True, message="Registration successful", data=token_response)


@router.post("/login", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def login(
    request: Request,
    payload: LoginRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    try:
        token_response = service.login(payload)
    except ValueError:
        raise Unauthorized("Invalid email or password.") from None

    return AuthResponse(success=True, message="Login successful", data=token_response)


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
        if str(exc) == "WRONG_CURRENT_PASSWORD":
            raise InvalidInput("Current password is incorrect.") from None
        raise InvalidInput("Could not update password.") from None

    return AuthResponse(success=True, message="Password updated successfully.", data=None)


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
        if str(exc) == "NOT_INVITED":
            raise InvalidInput(
                "Only invited accounts can complete onboarding here.",
            ) from None
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
        payload.billing_reminders_enabled,
    )
    if token_data is None:
        raise Unauthorized("Invalid or expired token.")

    return AuthResponse(
        success=True,
        message="Notification preferences updated.",
        data=token_data,
    )
