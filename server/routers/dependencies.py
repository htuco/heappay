from fastapi import Depends, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from exceptions import Unauthorized
from repositories.user.auth import UserAuthRepository
from services.user.auth import UserAuthService

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    db: Session = Depends(get_db),
) -> int:
    """Extract and verify user_id from the bearer token. Raises 401 if missing/invalid."""
    if credentials is None:
        raise Unauthorized("Authorization header is required.")

    service = UserAuthService(UserAuthRepository(db))
    user_id = service.verify_access_token(credentials.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token.")
    return user_id
