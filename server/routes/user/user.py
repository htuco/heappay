from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.user.user import UserRepository
from routes.dependencies import get_current_user_id, require_admin, require_staff
from schemas.response import ApiResponse
from schemas.user.crud import UserCreateRequest, UserResponse, UserSearchResponse, UserUpdateRequest
from services.storage.avatar_display_url import resolve_avatar_url_for_client
from services.user.user import (
    DuplicateEmailError,
    InvalidUserRoleError,
    InvalidUserStatusError,
    UserHasPendingTransactionError,
    UserNotFoundError,
    UserService,
)
from settings import get_settings
from utils.audit_log import (
    EVENT_USER_ACTIVATED,
    EVENT_USER_CREATED,
    EVENT_USER_DELETED,
    EVENT_USER_SUSPENDED,
    EVENT_USER_UPDATED,
    record_audit_log,
)

router = APIRouter(prefix="/users", tags=["users"])

_NOT_FOUND_DETAIL = "User not found"
_DUPLICATE_EMAIL_DETAIL = "Email already exists"
_INVALID_ROLE_DETAIL = "Invalid user_role_id"
_INVALID_STATUS_DETAIL = "Invalid status_id"
_PENDING_TX_DETAIL = "User has a pending transaction and cannot be deleted yet."


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    return UserService(UserRepository(db))


def _user_response_with_signed_avatar(
    row, *, total_spent: Decimal | None = None
) -> UserResponse:
    s = get_settings()
    r = UserResponse.model_validate(row)
    updates: dict = {}
    url = resolve_avatar_url_for_client(r.avatar_url, s)
    if url != r.avatar_url:
        updates["avatar_url"] = url
    if total_spent is not None:
        updates["total_spent"] = total_spent
    if not updates:
        return r
    return r.model_copy(update=updates)


@router.get("", response_model=list[UserResponse])
def list_users(
    q: str | None = Query(default=None),
    email: str | None = Query(default=None),
    status_id: int | None = Query(default=None, ge=1),
    user_role_id: int | None = Query(default=None, ge=1),
    include_deleted: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    _: int = Depends(require_staff),
    service: UserService = Depends(get_user_service),
) -> list[UserResponse]:
    rows = service.list_users(
        q=q.strip() if q else None,
        email=email,
        status_id=status_id,
        user_role_id=user_role_id,
        include_deleted=include_deleted,
        limit=limit,
        offset=offset,
    )
    # One grouped query for the whole page, so paging through every user
    # doesn't turn into a spend lookup per row.
    spend = service.total_spent_by_user([row.user_id for row in rows])
    return [
        _user_response_with_signed_avatar(
            row, total_spent=spend.get(row.user_id, Decimal("0"))
        )
        for row in rows
    ]


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
    _: int = Depends(require_admin),
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    try:
        row = service.get_user(user_id, include_deleted=include_deleted)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL) from exc
    spend = service.total_spent_by_user([row.user_id])
    return _user_response_with_signed_avatar(
        row, total_spent=spend.get(row.user_id, Decimal("0"))
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    actor_id: int = Depends(require_admin),
    db: Session = Depends(get_db),
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
    record_audit_log(
        db,
        event_type=EVENT_USER_CREATED,
        actor_user_id=actor_id,
        target_user_id=row.user_id,
        resource_type="user",
        resource_id=row.user_id,
        detail=f"email={row.email}",
    )
    return _user_response_with_signed_avatar(row)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    actor_id: int = Depends(require_admin),
    db: Session = Depends(get_db),
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
    record_audit_log(
        db,
        event_type=EVENT_USER_UPDATED,
        actor_user_id=actor_id,
        target_user_id=user_id,
        resource_type="user",
        resource_id=user_id,
    )
    return _user_response_with_signed_avatar(row)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    actor_id: int = Depends(require_admin),
    db: Session = Depends(get_db),
    service: UserService = Depends(get_user_service),
) -> Response:
    try:
        service.delete_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL) from exc
    except UserHasPendingTransactionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_PENDING_TX_DETAIL) from exc
    record_audit_log(
        db,
        event_type=EVENT_USER_DELETED,
        actor_user_id=actor_id,
        target_user_id=user_id,
        resource_type="user",
        resource_id=user_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Suspend / Activate (staff) ───────────────────────────────────────────────

@router.post("/{user_id}/suspend", response_model=UserResponse, summary="(Admin) Suspend a user account.")
def suspend_user(
    user_id: int,
    actor_id: int = Depends(require_admin),
    db: Session = Depends(get_db),
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    try:
        row = service.update_user(user_id, UserUpdateRequest(status_id=3))
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL) from exc
    record_audit_log(
        db,
        event_type=EVENT_USER_SUSPENDED,
        actor_user_id=actor_id,
        target_user_id=user_id,
        resource_type="user",
        resource_id=user_id,
    )
    return UserResponse.model_validate(row)


@router.post("/{user_id}/activate", response_model=UserResponse, summary="(Admin) Activate a user account.")
def activate_user(
    user_id: int,
    actor_id: int = Depends(require_admin),
    db: Session = Depends(get_db),
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    try:
        row = service.update_user(user_id, UserUpdateRequest(status_id=1))
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL) from exc
    record_audit_log(
        db,
        event_type=EVENT_USER_ACTIVATED,
        actor_user_id=actor_id,
        target_user_id=user_id,
        resource_type="user",
        resource_id=user_id,
    )
    return UserResponse.model_validate(row)
