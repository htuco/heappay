from sqlalchemy import select
from sqlalchemy.orm import Session

from models.user import User
from models.user_status import UserStatus


def get_status_by_id(db: Session, status_id: int) -> UserStatus | None:
    statement = select(UserStatus).where(UserStatus.id == status_id)
    return db.scalar(statement)



def list_statuses(db: Session) -> list[UserStatus]:
    statement = select(UserStatus).order_by(UserStatus.id)
    return list(db.scalars(statement).all())


def create_status(db: Session, status_name: str) -> UserStatus:
    status = UserStatus(status_name=status_name)
    db.add(status)
    db.commit()
    db.refresh(status)
    return status


def update_status(db: Session, status: UserStatus, status_name: str) -> UserStatus:
    status.status_name = status_name
    db.commit()
    db.refresh(status)
    return status


def delete_status(db: Session, status: UserStatus) -> None:
    db.delete(status)
    db.commit()


def is_status_in_use(db: Session, status_id: int) -> bool:
    statement = select(User.user_id).where(User.status_id == status_id).limit(1)
    return db.scalar(statement) is not None
