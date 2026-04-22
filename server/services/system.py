from sqlalchemy.orm import Session

from repositories import database_health


def root_payload() -> dict:
    return {"message": "OK"}


def ping_database(db: Session) -> dict:
    database_health.verify_live_connection(db)
    return {"database": "ok"}