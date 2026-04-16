from sqlalchemy import text
from sqlalchemy.orm import Session


def verify_live_connection(db: Session) -> None:
    db.execute(text("SELECT 1"))