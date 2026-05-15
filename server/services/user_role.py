from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.user_role import UserRole
from repositories import user_role as user_role_repository


class UserRoleNotFoundError(Exception):
    pass


class UserRoleConflictError(Exception):
    pass


class UserRoleInUseError(Exception):
    pass


class UserRoleValidationError(Exception):
    pass


def list_user_roles(db: Session) -> list[UserRole]:
    return user_role_repository.list_user_roles(db)


def get_user_role(db: Session, role_id: int) -> UserRole:
    role = user_role_repository.get_user_role_by_id(db, role_id)
    if role is None:
        raise UserRoleNotFoundError("User role not found.")
    return role


def create_user_role(db: Session, role_name: str) -> UserRole:
    normalized_role_name = _normalize_role_name(role_name)
    if user_role_repository.get_user_role_by_name(db, normalized_role_name):
        raise UserRoleConflictError("Role name already exists.")

    try:
        return user_role_repository.create_user_role(db, normalized_role_name)
    except IntegrityError as exc:
        db.rollback()
        raise UserRoleConflictError("Role name already exists.") from exc


def update_user_role(db: Session, role_id: int, role_name: str) -> UserRole:
    role = get_user_role(db, role_id)
    normalized_role_name = _normalize_role_name(role_name)

    existing_role = user_role_repository.get_user_role_by_name(db, normalized_role_name)
    if existing_role and existing_role.role_id != role.role_id:
        raise UserRoleConflictError("Role name already exists.")

    try:
        return user_role_repository.update_user_role_name(
            db, role=role, role_name=normalized_role_name
        )
    except IntegrityError as exc:
        db.rollback()
        raise UserRoleConflictError("Role name already exists.") from exc


def delete_user_role(db: Session, role_id: int) -> None:
    role = get_user_role(db, role_id)
    if user_role_repository.is_user_role_in_use(db, role.role_id):
        raise UserRoleInUseError(
            "Cannot delete role because it is assigned to one or more users."
        )

    user_role_repository.delete_user_role(db, role)


def _normalize_role_name(role_name: str) -> str:
    normalized_role_name = role_name.strip()
    if not normalized_role_name:
        raise UserRoleValidationError("Role name cannot be empty.")
    return normalized_role_name
