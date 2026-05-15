from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.user.crud import UserRepository
from routers.dependencies import get_current_user_id
from schemas.response import ApiResponse
from schemas.user.crud import UserCreateRequest, UserResponse, UserSearchResponse, UserUpdateRequest
from services.user.crud import (
    DuplicateEmailError,
    InvalidUserRoleError,
    InvalidUserStatusError,
    UserNotFoundError,
    UserService,
)

router = APIRouter(prefix="/users", tags=["users"])

_NOT_FOUND_DETAIL = "User not found"
_DUPLICATE_EMAIL_DETAIL = "Email already exists"
_INVALID_ROLE_DETAIL = "Invalid user_role_id"
_INVALID_STATUS_DETAIL = "Invalid status_id"


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    return UserService(UserRepository(db))


@router.get("", response_model=list[UserResponse])
def list_users(
    email: str | None = Query(default=None),
    status_id: int | None = Query(default=None, ge=1),
    user_role_id: int | None = Query(default=None, ge=1),
    include_deleted: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    service: UserService = Depends(get_user_service),
) -> list[UserResponse]:
    rows = service.list_users(
        email=email,
        status_id=status_id,
        user_role_id=user_role_id,
        include_deleted=include_deleted,
        limit=limit,
        offset=offset,
    )
    return [UserResponse.model_validate(row) for row in rows]


@router.get("/search", response_model=ApiResponse[list[UserSearchResponse]])
def search_users(
    q: str = Query(),
    current_user_id: int = Depends(get_current_user_id),
    service: UserService = Depends(get_user_service),
) -> ApiResponse[list[UserSearchResponse]]:
    # TODO: rate limit this endpoint during the future hardening pass.
    query = q.strip()
    if len(query) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 3 characters.",
        )
    rows = service.search(query, exclude_user_id=current_user_id, limit=10)
    return ApiResponse[list[UserSearchResponse]](
        success=True,
        message="User search completed.",
        data=rows,
    )


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    include_deleted: bool = Query(default=False),
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    try:
        row = service.get_user(user_id, include_deleted=include_deleted)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL) from exc
    return UserResponse.model_validate(row)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    try:
        row = service.create_user(payload)
    except DuplicateEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_EMAIL_DETAIL
        ) from exc
    except InvalidUserRoleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_ROLE_DETAIL) from exc
    except InvalidUserStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_STATUS_DETAIL
        ) from exc
    return UserResponse.model_validate(row)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    try:
        row = service.update_user(user_id, payload)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL) from exc
    except DuplicateEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_EMAIL_DETAIL
        ) from exc
    except InvalidUserRoleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_ROLE_DETAIL) from exc
    except InvalidUserStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_STATUS_DETAIL
        ) from exc
    return UserResponse.model_validate(row)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
) -> Response:
    try:
        service.delete_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
