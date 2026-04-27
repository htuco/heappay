from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.card_type import CardTypeRepository
from schemas.card_type import CardTypeCreate, CardTypeResponse, CardTypeUpdate
from services.card_type import (
    CardTypeInUseError,
    CardTypeService,
    DuplicateCardTypeError,
)

router = APIRouter(prefix="/card-types", tags=["card-types"])


def get_card_type_service(db: Session = Depends(get_db)) -> CardTypeService:
    return CardTypeService(CardTypeRepository(db))


_NOT_FOUND_DETAIL = "Card type not found"
_DUPLICATE_DETAIL = "Card type/vendor combination already exists"
_IN_USE_DETAIL = "Card type is in use and cannot be deleted"


@router.get("", response_model=list[CardTypeResponse])
def list_card_types(
    service: CardTypeService = Depends(get_card_type_service),
) -> list[CardTypeResponse]:
    rows = service.list_all()
    return [CardTypeResponse.model_validate(r) for r in rows]


@router.get("/{card_type_id}", response_model=CardTypeResponse)
def get_card_type(
    card_type_id: int,
    service: CardTypeService = Depends(get_card_type_service),
) -> CardTypeResponse:
    row = service.get_by_id(card_type_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL)
    return CardTypeResponse.model_validate(row)


@router.post("", response_model=CardTypeResponse, status_code=status.HTTP_201_CREATED)
def create_card_type(
    payload: CardTypeCreate,
    service: CardTypeService = Depends(get_card_type_service),
) -> CardTypeResponse:
    try:
        row = service.create(payload.type_name, payload.vendor)
    except DuplicateCardTypeError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_DETAIL) from None
    return CardTypeResponse.model_validate(row)


@router.patch("/{card_type_id}", response_model=CardTypeResponse)
def update_card_type(
    card_type_id: int,
    payload: CardTypeUpdate,
    service: CardTypeService = Depends(get_card_type_service),
) -> CardTypeResponse:
    try:
        row = service.update(
            card_type_id,
            type_name=payload.type_name,
            vendor=payload.vendor,
        )
    except DuplicateCardTypeError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_DETAIL) from None
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL)
    return CardTypeResponse.model_validate(row)


@router.delete("/{card_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card_type(
    card_type_id: int,
    service: CardTypeService = Depends(get_card_type_service),
) -> Response:
    try:
        deleted = service.delete(card_type_id)
    except CardTypeInUseError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_IN_USE_DETAIL) from None
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
