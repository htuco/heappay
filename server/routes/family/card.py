from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.card.card import CardRepository
from routes.dependencies import require_guardian_of
from schemas.card import CardCreate, CardResponse
from services.card.card import (
    CardBelongsToAnotherAccountError,
    CardNotFoundError,
    CardService,
    CardStatusNotFoundError,
    CardTypeNotFoundError,
    DuplicateCardNumberError,
    UserNotFoundError,
)
from tasks.sync import run_sync_for_user

router = APIRouter(prefix="/family", tags=["family"])

_CARD_NOT_FOUND = "Card not found."
_USER_NOT_FOUND = "User not found."
_STATUS_NOT_FOUND = "Card status not found."
_CARD_TYPE_NOT_FOUND = "Card type not found."
_DUPLICATE_CARD_NUMBER = "A card with this number is already registered."
_CARD_BELONGS_TO_ANOTHER_ACCOUNT = "This card belongs to another account."


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


def _require_dependents_card(service: CardService, *, card_id: int, dependent_user_id: int):
    """Load the card and confirm it actually belongs to this dependent.

    `require_guardian_of` only proves the caller is the guardian of
    `dependent_user_id` -- it says nothing about whether `card_id` belongs
    to them, so this closes that gap (a guardian of dependent A shouldn't
    be able to reach dependent B's card through A's own authorized path).
    """
    row = service.get_by_id(card_id)
    if row is None or row.user_id != dependent_user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _CARD_NOT_FOUND)
    return row


@router.post(
    "/dependents/{dependent_user_id}/cards",
    response_model=CardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="(Guardian) Issue a card for a dependent.",
)
def issue_dependent_card(
    dependent_user_id: int,
    payload: CardCreate,
    background_tasks: BackgroundTasks,
    _guardian_user_id: int = Depends(require_guardian_of),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    payload = payload.model_copy(update={"user_id": dependent_user_id})
    try:
        row = service.create(payload)
    except DuplicateCardNumberError:
        raise HTTPException(status.HTTP_409_CONFLICT, _DUPLICATE_CARD_NUMBER) from None
    except CardBelongsToAnotherAccountError:
        raise HTTPException(status.HTTP_409_CONFLICT, _CARD_BELONGS_TO_ANOTHER_ACCOUNT) from None
    except UserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _USER_NOT_FOUND) from None
    except CardStatusNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _STATUS_NOT_FOUND) from None
    except CardTypeNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _CARD_TYPE_NOT_FOUND) from None
    background_tasks.add_task(run_sync_for_user, dependent_user_id)
    return _to_response(row)


@router.post(
    "/dependents/{dependent_user_id}/cards/{card_id}/freeze",
    response_model=CardResponse,
    summary="(Guardian) Freeze a dependent's card.",
)
def freeze_dependent_card(
    dependent_user_id: int,
    card_id: int,
    _guardian_user_id: int = Depends(require_guardian_of),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    _require_dependents_card(service, card_id=card_id, dependent_user_id=dependent_user_id)
    try:
        row = service.set_status_by_name(card_id, "frozen")
    except (CardNotFoundError, CardStatusNotFoundError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, _CARD_NOT_FOUND) from None
    return _to_response(row)


@router.post(
    "/dependents/{dependent_user_id}/cards/{card_id}/unfreeze",
    response_model=CardResponse,
    summary="(Guardian) Unfreeze a dependent's card.",
)
def unfreeze_dependent_card(
    dependent_user_id: int,
    card_id: int,
    _guardian_user_id: int = Depends(require_guardian_of),
    service: CardService = Depends(get_card_service),
) -> CardResponse:
    _require_dependents_card(service, card_id=card_id, dependent_user_id=dependent_user_id)
    try:
        row = service.set_status_by_name(card_id, "active")
    except (CardNotFoundError, CardStatusNotFoundError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, _CARD_NOT_FOUND) from None
    return _to_response(row)
