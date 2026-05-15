from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.card_status import CardStatusRepository
from schemas.card_status import CardStatusCreate, CardStatusResponse, CardStatusUpdate
from services.card_status import CardStatusService

router = APIRouter(prefix="/card-statuses", tags=["card-statuses"])


def get_card_status_service(db: Session = Depends(get_db)) -> CardStatusService:
    return CardStatusService(CardStatusRepository(db))


@router.get("", response_model=list[CardStatusResponse])
def list_card_statuses(
    service: CardStatusService = Depends(get_card_status_service),
) -> list[CardStatusResponse]:
    return [CardStatusResponse.model_validate(r) for r in service.list_all()]


@router.get("/{card_status_id}", response_model=CardStatusResponse)
def get_card_status(
    card_status_id: int,
    service: CardStatusService = Depends(get_card_status_service),
) -> CardStatusResponse:
    return CardStatusResponse.model_validate(service.get_by_id(card_status_id))


@router.post("", response_model=CardStatusResponse, status_code=status.HTTP_201_CREATED)
def create_card_status(
    payload: CardStatusCreate,
    service: CardStatusService = Depends(get_card_status_service),
) -> CardStatusResponse:
    return CardStatusResponse.model_validate(service.create(payload.status_name))


@router.patch("/{card_status_id}", response_model=CardStatusResponse)
def update_card_status(
    card_status_id: int,
    payload: CardStatusUpdate,
    service: CardStatusService = Depends(get_card_status_service),
) -> CardStatusResponse:
    return CardStatusResponse.model_validate(
        service.update_name(card_status_id, payload.status_name)
    )


@router.delete("/{card_status_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card_status(
    card_status_id: int,
    service: CardStatusService = Depends(get_card_status_service),
) -> Response:
    service.delete(card_status_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
