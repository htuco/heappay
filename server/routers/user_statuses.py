from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from schemas import MessageResponse, UserStatusCreate, UserStatusRead, UserStatusUpdate
from services import user_statuses as user_status_service

router = APIRouter(prefix="/user-statuses", tags=["user-statuses"])


@router.get("", response_model=list[UserStatusRead])
def list_user_statuses(db: Session = Depends(get_db)):
    return user_status_service.list_user_statuses(db)


@router.get("/{status_id}", response_model=UserStatusRead)
def get_user_status(status_id: int, db: Session = Depends(get_db)):
    try:
        return user_status_service.get_user_status(db, status_id)
    except user_status_service.UserStatusNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "",
    response_model=UserStatusRead,
    status_code=status.HTTP_201_CREATED,
)
def create_user_status(payload: UserStatusCreate, db: Session = Depends(get_db)):
    try:
        return user_status_service.create_user_status(db, payload.status_name)
    except user_status_service.UserStatusValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except user_status_service.UserStatusConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.patch("/{status_id}", response_model=UserStatusRead)
def update_user_status(
    status_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
):
    try:
        return user_status_service.update_user_status(db, status_id, payload.status_name)
    except user_status_service.UserStatusNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except user_status_service.UserStatusValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except user_status_service.UserStatusConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.delete("/{status_id}", response_model=MessageResponse)
def delete_user_status(status_id: int, db: Session = Depends(get_db)):
    try:
        user_status_service.delete_user_status(db, status_id)
    except user_status_service.UserStatusNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except user_status_service.UserStatusInUseError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return {"message": "User status deleted successfully."}
