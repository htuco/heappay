from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.card import CardRepository
from schemas.card import CardCreate, CardPatch, CardResponse
from services.card import (
    CardNotFoundError,
    CardService,
    CardStatusNotFoundError,
    CardTypeNotFoundError,
    UserNotFoundError,
)

router = APIRouter(prefix="/cards", tags=["cards"])

_CARD_NOT_FOUND = "Card not found."
_USER_NOT_FOUND = "User not found."
_STATUS_NOT_FOUND = "Card status not found."
_CARD_TYPE_NOT_FOUND = "Card type not found."


def get_card_service(db: Session = Depends(get_db)) -> CardService:
    return CardService(CardRepository(db))


def _to_response(row) -> CardResponse:
    return CardResponse(
        card_id=row.card_id,
        user_id=row.user_id,
        status_id=row.status_id,
        card_type_id=row.card_type_id,
        last_four=row.last_four,
        masked_card_number=f"{'*' * 12}{row.last_four}",
        expires_at=row.expires_at,
        created_at=row.created_at,
        deleted_at=row.deleted_at,
    )


@router.get("", response_model=list[CardResponse])
def list_cards(
    user_id: int | None = Query(default=None, gt=0),
    status_id: int | None = Query(default=None, gt=0),
    card_type_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    service: CardService = Depends(get_card_service),
) -> list[CardResponse]:
    rows = service.list_all(
        user_id=user_id,
        status_id=status_id,
        card_type_id=card_type_id,
        limit=limit,
        offset=offset,
    )
    return [_to_response(r) for r in rows]


@router.get("/deleted", response_model=list[CardResponse])
def list_deleted_cards(
    user_id: int | None = Query(default=None, gt=0),
    status_id: int | None = Query(default=None, gt=0),
    card_type_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    service: CardService = Depends(get_card_service),
) -> list[CardResponse]:
    rows = service.list_all(
        user_id=user_id,
        status_id=status_id,
        card_type_id=card_type_id,
        limit=limit,
        offset=offset,
        include_deleted=True,
    )
    return [_to_response(r) for r in rows if r.deleted_at is not None]


@router.get("/{card_id}", response_model=CardResponse)
def get_card(
    card_id: int,
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    row = service.get_by_id(card_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND)
    return _to_response(row)


@router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
def create_card(
    payload: CardCreate,
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    try:
        row = service.create(payload)
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_USER_NOT_FOUND) from None
    except CardStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    except CardTypeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_TYPE_NOT_FOUND
        ) from None
    return _to_response(row)


@router.patch("/{card_id}", response_model=CardResponse)
def patch_card(
    card_id: int,
    payload: CardPatch,
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    try:
        row = service.patch(card_id, payload)
    except CardNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND) from None
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_USER_NOT_FOUND) from None
    except CardStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    except CardTypeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_TYPE_NOT_FOUND
        ) from None
    return _to_response(row)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: int,
    service: CardService = Depends(get_card_service),
) -> Response:
    try:
        service.delete(card_id)
    except CardNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{card_id}/restore", response_model=CardResponse)
def restore_card(
    card_id: int,
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    try:
        row = service.restore(card_id)
    except CardNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND) from None
    return _to_response(row)
