from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.user_status import UserStatus
from repositories import user_statuses as user_status_repository


def _normalize_status_name(status_name: str) -> str:
    normalized_name = status_name.strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status name cannot be empty.",
        )
    return normalized_name


def list_user_statuses(db: Session) -> list[UserStatus]:
    return user_status_repository.list_statuses(db)


def get_user_status(db: Session, status_id: int) -> UserStatus:
    user_status = user_status_repository.get_status_by_id(db, status_id)
    if user_status is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User status not found.",
        )
    return user_status


def create_user_status(db: Session, status_name: str) -> UserStatus:
    normalized_name = _normalize_status_name(status_name)
    existing_status = user_status_repository.get_status_by_name(db, normalized_name)
    if existing_status is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User status with this name already exists.",
        )

    return user_status_repository.create_status(db, normalized_name)


def update_user_status(db: Session, status_id: int, status_name: str) -> UserStatus:
    user_status = get_user_status(db, status_id)
    normalized_name = _normalize_status_name(status_name)
    existing_status = user_status_repository.get_status_by_name(db, normalized_name)
    if existing_status is not None and existing_status.id != status_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User status with this name already exists.",
        )

    if user_status.status_name == normalized_name:
        return user_status

    return user_status_repository.update_status(db, status_id, normalized_name)


def delete_user_status(db: Session, status_id: int) -> dict[str, str]:
    user_status = get_user_status(db, status_id)
    if user_status_repository.is_status_in_use(db, status_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User status is assigned to existing users and cannot be deleted.",
        )

    user_status_repository.delete_status(db, user_status)
    return {"message": "User status deleted successfully."}
