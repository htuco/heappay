from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.card_status import CardStatusRepository
from schemas.card_status import (
    CardStatusCreate,
    CardStatusResponse,
    CardStatusUpdate,
)
from services.card_status import (
    CardStatusService,
    DuplicateStatusNameError,
    StatusInUseError,
)

router = APIRouter(prefix="/card-statuses", tags=["card-statuses"])


def get_card_status_service(
    db: Session = Depends(get_db),
) -> CardStatusService:
    return CardStatusService(CardStatusRepository(db))


_DUPLICATE_DETAIL = "A card status with this name already exists."
_NOT_FOUND_DETAIL = "Card status not found."
_IN_USE_DETAIL = (
    "Cannot delete this status: one or more cards are still assigned to it."
)


@router.get("", response_model=list[CardStatusResponse])
def list_card_statuses(
    service: CardStatusService = Depends(get_card_status_service),
) -> list[CardStatusResponse]:
    rows = service.list_all()
    return [CardStatusResponse.model_validate(r) for r in rows]


@router.get("/{card_status_id}", response_model=CardStatusResponse)
def get_card_status(
    card_status_id: int,
    service: CardStatusService = Depends(get_card_status_service),
) -> CardStatusResponse:
    row = service.get_by_id(card_status_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL
        )
    return CardStatusResponse.model_validate(row)


@router.post(
    "",
    response_model=CardStatusResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_card_status(
    payload: CardStatusCreate,
    service: CardStatusService = Depends(get_card_status_service),
) -> CardStatusResponse:
    try:
        row = service.create(payload.status_name)
    except DuplicateStatusNameError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_DETAIL
        ) from None
    return CardStatusResponse.model_validate(row)


@router.patch("/{card_status_id}", response_model=CardStatusResponse)
def update_card_status(
    card_status_id: int,
    payload: CardStatusUpdate,
    service: CardStatusService = Depends(get_card_status_service),
) -> CardStatusResponse:
    try:
        row = service.update_name(card_status_id, payload.status_name)
    except DuplicateStatusNameError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_DETAIL
        ) from None
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL
        )
    return CardStatusResponse.model_validate(row)


@router.delete(
    "/{card_status_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_card_status(
    card_status_id: int,
    service: CardStatusService = Depends(get_card_status_service),
) -> Response:
    try:
        deleted = service.delete(card_status_id)
    except StatusInUseError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_IN_USE_DETAIL
        ) from None
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
