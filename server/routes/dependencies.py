from dataclasses import dataclass

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from exceptions import Unauthorized
from models.card import Card
from models.family_link import FamilyLink
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
    is_verified: bool = True


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
    """Return the current user's id, role, and email verification status."""
    stmt = (
        select(UserRole.role_name, User.email_verified_at)
        .join(User, User.user_role_id == UserRole.role_id)
        .where(User.user_id == user_id)
    )
    row = db.execute(stmt).one_or_none()
    role_name = row[0] if row else None
    verified_at = row[1] if row else None
    return UserContext(
        user_id=user_id,
        is_admin=(role_name == ADMIN_ROLE_NAME),
        is_staff=(role_name in STAFF_ROLE_NAMES),
        is_verified=(verified_at is not None),
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


def require_verified_user(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> int:
    """Authorize that the current user has verified their email. Returns user_id; raises 403 otherwise."""
    verified_at = db.execute(
        select(User.email_verified_at).where(User.user_id == user_id)
    ).scalar_one_or_none()
    if verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before completing this action.",
        )
    return user_id


def require_verified_context(
    ctx: UserContext = Depends(get_user_context),
) -> UserContext:
    """Authorize that the current user has verified their email. Returns ctx; raises 403 otherwise."""
    if not ctx.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before completing this action.",
        )
    return ctx


def require_guardian_of(
    dependent_user_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> int:
    """Authorize current user as the accepted guardian of `dependent_user_id`.

    FastAPI injects the `dependent_user_id` path parameter into this
    dependency by name, so every family-scoped route must name its path
    segment exactly `{dependent_user_id}`. Returns the guardian's user_id;
    raises 403 otherwise.
    """
    stmt = select(FamilyLink.family_link_id).where(
        FamilyLink.guardian_user_id == user_id,
        FamilyLink.dependent_user_id == dependent_user_id,
        FamilyLink.status == "accepted",
    )
    if db.execute(stmt).scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not this user's guardian.",
        )
    return user_id


def require_owns_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> int:
    """Authorize current user as the owner of `card_id`.

    Mirrors `require_guardian_of`'s path-param-by-name shape -- every
    card-scoped family route must name its path segment exactly `{card_id}`.
    404s if the card doesn't exist, 403s if the current user isn't its owner.
    """
    stmt = select(Card.user_id).where(Card.card_id == card_id, Card.deleted_at.is_(None))
    owner_id = db.execute(stmt).scalar_one_or_none()
    if owner_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found.")
    if owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this card.",
        )
    return user_id
