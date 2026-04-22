from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from services import system as system_service

router = APIRouter(tags=["system"])


@router.get("/")
def read_root():
    return system_service.root_payload()


@router.get("/db/ping")
def db_ping(db: Session = Depends(get_db)):
    return system_service.ping_database(db)