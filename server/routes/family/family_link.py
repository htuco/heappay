from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.family.family_link import FamilyLinkRepository
from repositories.user.user import UserRepository
from routes.dependencies import get_current_user_id
from schemas.family_link import FamilyLinkInviteCreate, FamilyLinkResponse
from schemas.response import ApiResponse
from services.family.family_link import (
    FamilyLinkAlreadyGuardedError,
    FamilyLinkAlreadyPendingError,
    FamilyLinkDependentNotFoundError,
    FamilyLinkForbiddenError,
    FamilyLinkNotFoundError,
    FamilyLinkNotPendingError,
    FamilyLinkSelfLinkError,
    FamilyLinkService,
)

router = APIRouter(prefix="/family", tags=["family"])


def get_family_link_service(db: Session = Depends(get_db)) -> FamilyLinkService:
    return FamilyLinkService(FamilyLinkRepository(db), UserRepository(db))


@router.post(
    "/invites",
    response_model=ApiResponse[FamilyLinkResponse],
    status_code=status.HTTP_201_CREATED,
)
def invite_dependent(
    payload: FamilyLinkInviteCreate,
    guardian_user_id: int = Depends(get_current_user_id),
    service: FamilyLinkService = Depends(get_family_link_service),
) -> ApiResponse[FamilyLinkResponse]:
    try:
        link = service.invite(guardian_user_id=guardian_user_id, dependent_email=payload.dependent_email)
    except FamilyLinkDependentNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except FamilyLinkSelfLinkError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except (FamilyLinkAlreadyGuardedError, FamilyLinkAlreadyPendingError) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return ApiResponse[FamilyLinkResponse](success=True, message="Invite sent.", data=link)


@router.get("/invites", response_model=ApiResponse[list[FamilyLinkResponse]])
def list_incoming_invites(
    dependent_user_id: int = Depends(get_current_user_id),
    service: FamilyLinkService = Depends(get_family_link_service),
) -> ApiResponse[list[FamilyLinkResponse]]:
    invites = service.list_my_incoming_invites(dependent_user_id)
    return ApiResponse[list[FamilyLinkResponse]](
        success=True, message="Invites retrieved.", data=invites
    )


@router.post(
    "/invites/{family_link_id}/accept",
    response_model=ApiResponse[FamilyLinkResponse],
)
def accept_invite(
    family_link_id: int,
    dependent_user_id: int = Depends(get_current_user_id),
    service: FamilyLinkService = Depends(get_family_link_service),
) -> ApiResponse[FamilyLinkResponse]:
    try:
        link = service.accept(family_link_id=family_link_id, dependent_user_id=dependent_user_id)
    except FamilyLinkNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except FamilyLinkNotPendingError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    except FamilyLinkAlreadyGuardedError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return ApiResponse[FamilyLinkResponse](success=True, message="Invite accepted.", data=link)


@router.post(
    "/invites/{family_link_id}/decline",
    response_model=ApiResponse[FamilyLinkResponse],
)
def decline_invite(
    family_link_id: int,
    dependent_user_id: int = Depends(get_current_user_id),
    service: FamilyLinkService = Depends(get_family_link_service),
) -> ApiResponse[FamilyLinkResponse]:
    try:
        link = service.decline(family_link_id=family_link_id, dependent_user_id=dependent_user_id)
    except FamilyLinkNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except FamilyLinkNotPendingError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return ApiResponse[FamilyLinkResponse](success=True, message="Invite declined.", data=link)


@router.post(
    "/links/{family_link_id}/revoke",
    response_model=ApiResponse[FamilyLinkResponse],
)
def revoke_link(
    family_link_id: int,
    actor_user_id: int = Depends(get_current_user_id),
    service: FamilyLinkService = Depends(get_family_link_service),
) -> ApiResponse[FamilyLinkResponse]:
    try:
        link = service.revoke(family_link_id=family_link_id, actor_user_id=actor_user_id)
    except FamilyLinkNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except FamilyLinkForbiddenError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc))
    except FamilyLinkNotPendingError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return ApiResponse[FamilyLinkResponse](success=True, message="Family link revoked.", data=link)


@router.get("/dependents", response_model=ApiResponse[list[FamilyLinkResponse]])
def list_dependents(
    guardian_user_id: int = Depends(get_current_user_id),
    service: FamilyLinkService = Depends(get_family_link_service),
) -> ApiResponse[list[FamilyLinkResponse]]:
    dependents = service.list_my_dependents(guardian_user_id)
    return ApiResponse[list[FamilyLinkResponse]](
        success=True, message="Dependents retrieved.", data=dependents
    )
