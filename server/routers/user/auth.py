from fastapi import APIRouter, Depends, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from exceptions import InvalidInput, Unauthorized
from repositories.user.auth import UserAuthRepository
from schemas.user.auth import AuthResponse, LoginRequest, RegisterRequest
from services.user.auth import UserAuthService

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)


def get_auth_service(db: Session = Depends(get_db)) -> UserAuthService:
    return UserAuthService(UserAuthRepository(db))


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    try:
        token_response = service.register(payload)
    except ValueError:
        raise InvalidInput("An account with this email already exists.") from None

    return AuthResponse(success=True, message="Registration successful", data=token_response)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    service: UserAuthService = Depends(get_auth_service),
) -> AuthResponse:
    try:
        token_response = service.login(payload)
    except ValueError:
        raise Unauthorized("Invalid email or password.") from None

    return AuthResponse(success=True, message="Login successful", data=token_response)


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
