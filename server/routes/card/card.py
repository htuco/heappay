from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.card.card import CardRepository
from routes.dependencies import UserContext, get_user_context, require_staff
from schemas.card import CardCreate, CardLookupResponse, CardPatch, CardResponse
from services.card.card import (
    CardDoesNotBelongToUserError,
    CardNotFoundError,
    CardService,
    CardStatusNotFoundError,
    CardTypeNotFoundError,
    DuplicateCardNumberError,
    UserNotFoundError,
)

router = APIRouter(prefix="/cards", tags=["cards"])

_CARD_NOT_FOUND = "Card not found."
_USER_NOT_FOUND = "User not found."
_STATUS_NOT_FOUND = "Card status not found."
_CARD_TYPE_NOT_FOUND = "Card type not found."
_DUPLICATE_CARD_NUMBER = "A card with this number is already registered."
_FORBIDDEN = "You do not have access to this card."
_FORBIDDEN_OTHER_USER = "You cannot manage cards for other users."
_NO_MAIN_CARD = "No main card set for this user."


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
        balance=row.balance,
        cardholder_name=row.cardholder_name,
        created_at=row.created_at,
        deleted_at=row.deleted_at,
        is_main=row.is_main,
    )


def _require_owner_or_staff(card_user_id: int, ctx: UserContext) -> None:
    if not ctx.is_staff and card_user_id != ctx.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN)


# ─── Lookup (any authenticated user) ─────────────────────────────────────────

@router.get("/lookup", response_model=CardLookupResponse)
def lookup_card(
    card_number: str = Query(min_length=13, max_length=19),
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> CardLookupResponse:
    normalized = card_number.replace(" ", "").replace("-", "")
    result = service.lookup_by_card_number(normalized)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND)
    card, user = result
    return CardLookupResponse(
        card_id=card.card_id,
        last_four=card.last_four,
        masked_card_number=f"{'*' * 12}{card.last_four}",
        owner_name=f"{user.first_name} {user.last_name}".strip(),
        owner_email=user.email,
        user_id=user.user_id,
        cardholder_name=card.cardholder_name,
    )


# ─── List (active) ────────────────────────────────────────────────────────────

@router.get("", response_model=list[CardResponse])
def list_cards(
    user_id: int | None = Query(default=None, gt=0),
    status_id: int | None = Query(default=None, gt=0),
    card_type_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> list[CardResponse]:
    if not ctx.is_staff:
        if user_id is not None and user_id != ctx.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN_OTHER_USER
            )
        user_id = ctx.user_id
    rows = service.list_all(
        user_id=user_id,
        status_id=status_id,
        card_type_id=card_type_id,
        limit=limit,
        offset=offset,
    )
    return [_to_response(r) for r in rows]


# ─── List (deleted) ───────────────────────────────────────────────────────────

@router.get("/deleted", response_model=list[CardResponse])
def list_deleted_cards(
    user_id: int | None = Query(default=None, gt=0),
    status_id: int | None = Query(default=None, gt=0),
    card_type_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> list[CardResponse]:
    if not ctx.is_staff:
        if user_id is not None and user_id != ctx.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN_OTHER_USER
            )
        user_id = ctx.user_id
    rows = service.list_all(
        user_id=user_id,
        status_id=status_id,
        card_type_id=card_type_id,
        limit=limit,
        offset=offset,
        include_deleted=True,
    )
    return [_to_response(r) for r in rows if r.deleted_at is not None]


# ─── Get main ────────────────────────────────────────────────────────────────

@router.get("/main", response_model=CardResponse)
def get_main_card(
    user_id: int | None = Query(default=None, gt=0),
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    if not ctx.is_admin:
        if user_id is not None and user_id != ctx.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN_OTHER_USER
            )
        user_id = ctx.user_id
    if user_id is None:
        user_id = ctx.user_id
    row = service.get_main_card(user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NO_MAIN_CARD)
    return _to_response(row)


# ─── Get one ──────────────────────────────────────────────────────────────────

@router.get("/{card_id}", response_model=CardResponse)
def get_card(
    card_id: int,
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    row = service.get_by_id(card_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND)
    _require_owner_or_staff(row.user_id, ctx)
    return _to_response(row)


# ─── Create ───────────────────────────────────────────────────────────────────

@router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
def create_card(
    payload: CardCreate,
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    if not ctx.is_staff and payload.user_id != ctx.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN_OTHER_USER
        )
    try:
        row = service.create(payload)
    except DuplicateCardNumberError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_CARD_NUMBER
        ) from None
    except UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_USER_NOT_FOUND
        ) from None
    except CardStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    except CardTypeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_TYPE_NOT_FOUND
        ) from None
    return _to_response(row)


# ─── Patch ────────────────────────────────────────────────────────────────────

@router.patch("/{card_id}", response_model=CardResponse)
def patch_card(
    card_id: int,
    payload: CardPatch,
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    row = service.get_by_id(card_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND)
    _require_owner_or_staff(row.user_id, ctx)
    try:
        row = service.patch(card_id, payload)
    except CardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND
        ) from None
    except UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_USER_NOT_FOUND
        ) from None
    except CardStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    except CardTypeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_TYPE_NOT_FOUND
        ) from None
    return _to_response(row)


# ─── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: int,
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> Response:
    row = service.get_by_id(card_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND)
    _require_owner_or_staff(row.user_id, ctx)
    service.delete(card_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Restore ──────────────────────────────────────────────────────────────────

@router.post("/{card_id}/block", response_model=CardResponse, summary="(Staff) Block a card.")
def block_card(
    card_id: int,
    _: int = Depends(require_staff),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    if service.get_by_id(card_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND)
    try:
        row = service.patch(card_id, CardPatch(status_id=3))
    except (CardNotFoundError, CardStatusNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND) from None
    return _to_response(row)


@router.post("/{card_id}/unblock", response_model=CardResponse, summary="(Staff) Unblock a card.")
def unblock_card(
    card_id: int,
    _: int = Depends(require_staff),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    if service.get_by_id(card_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND)
    try:
        row = service.patch(card_id, CardPatch(status_id=1))
    except (CardNotFoundError, CardStatusNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND) from None
    return _to_response(row)


@router.post("/{card_id}/restore", response_model=CardResponse)
def restore_card(
    card_id: int,
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    row = service.get_by_id_including_deleted(card_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND)
    _require_owner_or_staff(row.user_id, ctx)
    try:
        row = service.restore(card_id)
    except CardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND
        ) from None
    return _to_response(row)


# ─── Set main ─────────────────────────────────────────────────────────────────

@router.patch("/{card_id}/set-main", response_model=CardResponse)
def set_main_card(
    card_id: int,
    ctx: UserContext = Depends(get_user_context),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    row = service.get_by_id(card_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND)
    _require_owner_or_admin(row.user_id, ctx)
    target_user_id = row.user_id
    try:
        row = service.set_main_card(target_user_id, card_id)
    except CardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND
        ) from None
    except CardDoesNotBelongToUserError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        ) from None
    return _to_response(row)
