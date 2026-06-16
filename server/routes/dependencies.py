from dataclasses import dataclass

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from exceptions import Unauthorized
from models.user import User
from models.user_role import UserRole
from repositories.user.auth import UserAuthRepository
from services.user.auth import UserAuthService

bearer_scheme = HTTPBearer(auto_error=False)

ADMIN_ROLE_NAME = "admin"
STAFF_ROLE_NAMES = {"admin", "support"}


@dataclass
class UserContext:
    user_id: int
    is_admin: bool
    is_staff: bool


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    db: Session = Depends(get_db),
) -> int:
    """Extract and verify user_id from the bearer token. Raises 401 if missing/invalid."""
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    service = UserAuthService(UserAuthRepository(db))
    user_id = service.resolve_active_user_id(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")
    return user_id


def get_user_context(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> UserContext:
    """Return the current user's id and whether they hold the admin role."""
    stmt = (
        select(UserRole.role_name)
        .join(User, User.user_role_id == UserRole.role_id)
        .where(User.user_id == user_id)
    )
    role_name = db.execute(stmt).scalar_one_or_none()
    return UserContext(
        user_id=user_id,
        is_admin=(role_name == ADMIN_ROLE_NAME),
        is_staff=(role_name in STAFF_ROLE_NAMES),
    )


def require_admin(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> int:
    """Authorize current user as admin. Returns user_id; raises 403 otherwise."""
    stmt = (
        select(UserRole.role_name)
        .join(User, User.user_role_id == UserRole.role_id)
        .where(User.user_id == user_id)
    )
    role_name = db.execute(stmt).scalar_one_or_none()
    if role_name != ADMIN_ROLE_NAME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return user_id


def require_staff(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> int:
    """Authorize admin or support. Returns user_id; raises 403 otherwise."""
    stmt = (
        select(UserRole.role_name)
        .join(User, User.user_role_id == UserRole.role_id)
        .where(User.user_id == user_id)
    )
    role_name = db.execute(stmt).scalar_one_or_none()
    if role_name not in STAFF_ROLE_NAMES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff privileges required.",
        )
    return user_id
