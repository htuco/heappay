from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.user_status import UserStatus
from repositories import user_statuses as user_status_repository


class UserStatusNotFoundError(Exception):
    pass


class UserStatusConflictError(Exception):
    pass


class UserStatusInUseError(Exception):
    pass


class UserStatusValidationError(Exception):
    pass


def _normalize_status_name(status_name: str) -> str:
    normalized_name = status_name.strip()
    if not normalized_name:
        raise UserStatusValidationError("Status name cannot be empty.")
    return normalized_name


def list_user_statuses(db: Session) -> list[UserStatus]:
    return user_status_repository.list_statuses(db)


def get_user_status(db: Session, status_id: int) -> UserStatus:
    user_status = user_status_repository.get_status_by_id(db, status_id)
    if user_status is None:
        raise UserStatusNotFoundError("User status not found.")
    return user_status


def create_user_status(db: Session, status_name: str) -> UserStatus:
    normalized_name = _normalize_status_name(status_name)
    existing_status = user_status_repository.get_status_by_name(db, normalized_name)
    if existing_status is not None:
        raise UserStatusConflictError("User status with this name already exists.")

    try:
        return user_status_repository.create_status(db, normalized_name)
    except IntegrityError as exc:
        db.rollback()
        raise UserStatusConflictError(
            "User status with this name already exists."
        ) from exc


def update_user_status(db: Session, status_id: int, status_name: str) -> UserStatus:
    user_status = get_user_status(db, status_id)
    normalized_name = _normalize_status_name(status_name)
    existing_status = user_status_repository.get_status_by_name(db, normalized_name)
    if existing_status is not None and existing_status.id != status_id:
        raise UserStatusConflictError("User status with this name already exists.")

    if user_status.status_name == normalized_name:
        return user_status

    try:
        return user_status_repository.update_status(db, user_status, normalized_name)
    except IntegrityError as exc:
        db.rollback()
        raise UserStatusConflictError(
            "User status with this name already exists."
        ) from exc


def delete_user_status(db: Session, status_id: int) -> None:
    user_status = get_user_status(db, status_id)
    if user_status_repository.is_status_in_use(db, status_id):
        raise UserStatusInUseError(
            "User status is assigned to existing users and cannot be deleted."
        )

    user_status_repository.delete_status(db, user_status)
