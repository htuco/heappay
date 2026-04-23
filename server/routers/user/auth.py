from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.user.auth import UserAuthRepository
from schemas.user.auth import AuthResponse, LoginRequest, RegisterRequest, TokenResponse, UserResponse
from services.user.auth import UserAuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(db: Session = Depends(get_db)) -> UserAuthService:
    return UserAuthService(UserAuthRepository(db))


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is required",
        )
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is required",
        )
    return token


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    try:
        token_response = service.register(payload)
    except ValueError:
        # Duplicate or invalid registration; do not echo internal or user-identifying details
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration could not be completed",
        ) from None

    return AuthResponse(
        success=True,
        message="Registration successful",
        data=token_response,
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    try:
        token_response = service.login(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc

    return AuthResponse(
        success=True,
        message="Login successful",
        data=token_response,
    )


@router.get("/me", response_model=AuthResponse)
def me(
    service: UserAuthService = Depends(get_auth_service),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> AuthResponse:
    token = _extract_bearer_token(authorization)
    user_id = service.verify_refresh_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = service.repo.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_out = UserResponse.model_validate(user)
    token_data = TokenResponse(
        refresh_token=token,
        token_type="bearer",
        user=user_out,
    )
    return AuthResponse(
        success=True,
        message="User profile retrieved",
        data=token_data,
    )
