from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.user import User
from models.user_role import UserRole


def list_user_roles(db: Session) -> list[UserRole]:
    stmt = select(UserRole).order_by(UserRole.role_id.asc())
    return list(db.scalars(stmt).all())


def get_user_role_by_id(db: Session, role_id: int) -> UserRole | None:
    stmt = select(UserRole).where(UserRole.role_id == role_id)
    return db.scalars(stmt).first()


def get_user_role_by_name(db: Session, role_name: str) -> UserRole | None:
    stmt = select(UserRole).where(UserRole.role_name == role_name)
    return db.scalars(stmt).first()


def create_user_role(db: Session, role_name: str) -> UserRole:
    role = UserRole(role_name=role_name)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def update_user_role_name(db: Session, role: UserRole, role_name: str) -> UserRole:
    role.role_name = role_name
    db.commit()
    db.refresh(role)
    return role


def is_user_role_in_use(db: Session, role_id: int) -> bool:
    stmt = select(func.count(User.user_id)).where(User.user_role_id == role_id)
    return bool(db.scalar(stmt))


def delete_user_role(db: Session, role: UserRole) -> None:
    db.delete(role)
    db.commit()
