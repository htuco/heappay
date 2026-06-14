from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import get_db
from routes.dependencies import require_admin
from schemas.user_roles import (
    UserRoleCreateRequest,
    UserRoleResponse,
    UserRoleUpdateRequest,
)
from services.user import user_role as user_role_service

router = APIRouter(prefix="/user-roles", tags=["user_roles"])


@router.get("", response_model=list[UserRoleResponse], status_code=status.HTTP_200_OK)
def list_user_roles(db: Session = Depends(get_db)) -> list[UserRoleResponse]:
    return user_role_service.list_user_roles(db)


@router.get(
    "/{role_id}", response_model=UserRoleResponse, status_code=status.HTTP_200_OK
)
def get_user_role(role_id: int, db: Session = Depends(get_db)) -> UserRoleResponse:
    try:
        return user_role_service.get_user_role(db, role_id)
    except user_role_service.UserRoleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post("", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
def create_user_role(
    payload: UserRoleCreateRequest,
    db: Session = Depends(get_db),
    _: int = Depends(require_admin),
) -> UserRoleResponse:
    try:
        return user_role_service.create_user_role(db, payload.role_name)
    except user_role_service.UserRoleValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except user_role_service.UserRoleConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.patch(
    "/{role_id}", response_model=UserRoleResponse, status_code=status.HTTP_200_OK
)
def update_user_role(
    role_id: int,
    payload: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
    _: int = Depends(require_admin),
) -> UserRoleResponse:
    try:
        return user_role_service.update_user_role(db, role_id, payload.role_name)
    except user_role_service.UserRoleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except user_role_service.UserRoleValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except user_role_service.UserRoleConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: int = Depends(require_admin),
) -> Response:
    try:
        user_role_service.delete_user_role(db, role_id)
    except user_role_service.UserRoleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except user_role_service.UserRoleInUseError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
