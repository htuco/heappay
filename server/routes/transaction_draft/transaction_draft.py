from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from sqlalchemy.orm import Session

from database import get_db
from ratelimit import TRANSACTION_RATE_LIMIT, limiter, user_id_key_func
from repositories.transaction.transaction import TransactionRepository
from repositories.transaction_draft.transaction_draft import TransactionDraftRepository
from repositories.user.auth import UserAuthRepository
from routes.dependencies import get_current_user_id, require_verified_user

# The send response is an ordinary transaction, so it is built by the ordinary
# transaction serialiser rather than a second copy of the same card-to-party
# mapping. Importing it keeps the two responses identical by construction.
from routes.transaction.transaction import _to_detail_response
from schemas.response import ApiResponse
from schemas.transaction import TransactionResponse
from schemas.transaction_draft import (
    TransactionDraftCreate,
    TransactionDraftResponse,
    TransactionDraftSendRequest,
    TransactionDraftUpdate,
)
from services.transaction.transaction import (
    ApprovalRequiredError,
    CardFrozenError,
    CardNotFoundError,
    DuplicatePaymentError,
    ForbiddenError,
    InsufficientBalanceError,
    SpendingLimitExceededError,
    TransactionCategoryNotFoundError,
    TransactionService,
    TransactionStatusNotFoundError,
    TransactionTypeNotFoundError,
)
from services.transaction_draft.transaction_draft import (
    MAX_DRAFTS_PER_USER,
    TransactionDraftCardError,
    TransactionDraftCategoryError,
    TransactionDraftForbiddenError,
    TransactionDraftIncompleteError,
    TransactionDraftLimitReachedError,
    TransactionDraftNotFoundError,
    TransactionDraftService,
    TransactionDraftTypeError,
)
from tasks.sync import run_sync_for_user

router = APIRouter(prefix="/transaction-drafts", tags=["transaction-drafts"])

_NOT_FOUND = "Draft not found."
_FORBIDDEN = "You do not have access to this resource."
_CARD_ERROR = "One of the referenced cards was not found or can't be used by you."
# Worded exactly as the transaction routes word them, so the same mistake reads
# the same whether it was made in the wizard or on a draft.
_CATEGORY_NOT_FOUND = "Transaction category not found."
_TYPE_NOT_FOUND = "Transaction type not found."
_STATUS_NOT_FOUND = "Transaction status not found."
_CARD_NOT_FOUND = "One of the referenced cards was not found."
_INSUFFICIENT_BALANCE = "Sender card has insufficient balance."
_SENDER_CARD_FROZEN = "This card is frozen and can't be used to send money."
_RECIPIENT_CARD_FROZEN = "The recipient's card is frozen and can't receive money."
_DUPLICATE_PAYMENT = (
    "A similar payment to this recipient was already submitted. "
    "Please wait before trying again."
)
_APPROVAL_REQUIRED = "Step-up verification failed or approval is not allowed."
_SPENDING_LIMIT_EXCEEDED = "This would exceed a spending limit set by your guardian."
_LIMIT_REACHED = (
    f"You can keep up to {MAX_DRAFTS_PER_USER} drafts. "
    "Send or discard one before saving another."
)
_INCOMPLETE = "This draft is missing something it needs before it can be sent."


def get_transaction_draft_service(db: Session = Depends(get_db)) -> TransactionDraftService:
    tx_repo = TransactionRepository(db)
    return TransactionDraftService(
        TransactionDraftRepository(db),
        tx_repo,
        TransactionService(tx_repo, auth_repo=UserAuthRepository(db)),
    )


@router.post(
    "",
    response_model=ApiResponse[TransactionDraftResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Save a payment to finish later. Moves no money.",
)
def create_transaction_draft(
    payload: TransactionDraftCreate,
    user_id: int = Depends(require_verified_user),
    service: TransactionDraftService = Depends(get_transaction_draft_service),
) -> ApiResponse[TransactionDraftResponse]:
    try:
        row = service.create(payload, user_id=user_id)
    except TransactionDraftLimitReachedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_LIMIT_REACHED
        ) from None
    except TransactionDraftCardError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_ERROR) from None
    except TransactionDraftCategoryError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CATEGORY_NOT_FOUND
        ) from None
    except TransactionDraftTypeError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TYPE_NOT_FOUND
        ) from None
    return ApiResponse[TransactionDraftResponse](
        success=True,
        message="Draft saved successfully.",
        data=TransactionDraftResponse.model_validate(row),
    )


@router.get("", response_model=ApiResponse[list[TransactionDraftResponse]])
def list_transaction_drafts(
    user_id: int = Depends(get_current_user_id),
    service: TransactionDraftService = Depends(get_transaction_draft_service),
) -> ApiResponse[list[TransactionDraftResponse]]:
    rows = service.list_for_user(user_id=user_id)
    return ApiResponse[list[TransactionDraftResponse]](
        success=True,
        message="Drafts retrieved successfully.",
        data=[TransactionDraftResponse.model_validate(row) for row in rows],
    )


@router.get("/{draft_id}", response_model=ApiResponse[TransactionDraftResponse])
def get_transaction_draft(
    draft_id: int,
    user_id: int = Depends(get_current_user_id),
    service: TransactionDraftService = Depends(get_transaction_draft_service),
) -> ApiResponse[TransactionDraftResponse]:
    try:
        row = service.get_by_id_for_user(draft_id, user_id=user_id)
    except TransactionDraftNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except TransactionDraftForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    return ApiResponse[TransactionDraftResponse](
        success=True,
        message="Draft retrieved successfully.",
        data=TransactionDraftResponse.model_validate(row),
    )


@router.patch("/{draft_id}", response_model=ApiResponse[TransactionDraftResponse])
def update_transaction_draft(
    draft_id: int,
    payload: TransactionDraftUpdate,
    user_id: int = Depends(require_verified_user),
    service: TransactionDraftService = Depends(get_transaction_draft_service),
) -> ApiResponse[TransactionDraftResponse]:
    try:
        row = service.update(draft_id, payload, user_id=user_id)
    except TransactionDraftNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except TransactionDraftForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except TransactionDraftCardError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_ERROR) from None
    except TransactionDraftCategoryError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CATEGORY_NOT_FOUND
        ) from None
    except TransactionDraftTypeError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TYPE_NOT_FOUND
        ) from None
    return ApiResponse[TransactionDraftResponse](
        success=True,
        message="Draft updated successfully.",
        data=TransactionDraftResponse.model_validate(row),
    )


@router.delete("/{draft_id}", response_model=ApiResponse[None])
def delete_transaction_draft(
    draft_id: int,
    user_id: int = Depends(require_verified_user),
    service: TransactionDraftService = Depends(get_transaction_draft_service),
) -> ApiResponse[None]:
    try:
        service.delete(draft_id, user_id=user_id)
    except TransactionDraftNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except TransactionDraftForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    return ApiResponse[None](success=True, message="Draft discarded successfully.", data=None)


@router.post(
    "/{draft_id}/send",
    response_model=ApiResponse[TransactionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Send a saved draft through the normal transaction create path.",
)
@limiter.limit(TRANSACTION_RATE_LIMIT, key_func=user_id_key_func)
def send_transaction_draft(
    request: Request,
    draft_id: int,
    payload: TransactionDraftSendRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(require_verified_user),
    service: TransactionDraftService = Depends(get_transaction_draft_service),
) -> ApiResponse[TransactionResponse]:
    """Every failure below leaves the draft untouched, so the user can retry."""
    try:
        row, created = service.send(draft_id, payload, user_id=user_id)
    except TransactionDraftNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except TransactionDraftForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except TransactionDraftIncompleteError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc) or _INCOMPLETE
        ) from None
    except CardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND
        ) from None
    except TransactionTypeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TYPE_NOT_FOUND
        ) from None
    except TransactionStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    except TransactionCategoryNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CATEGORY_NOT_FOUND
        ) from None
    except InsufficientBalanceError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_INSUFFICIENT_BALANCE
        ) from None
    except CardFrozenError as exc:
        detail = _SENDER_CARD_FROZEN if exc.side == "sender" else _RECIPIENT_CARD_FROZEN
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from None
    except DuplicatePaymentError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_PAYMENT
        ) from None
    except SpendingLimitExceededError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_SPENDING_LIMIT_EXCEEDED
        ) from None
    except ApprovalRequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc) or _APPROVAL_REQUIRED
        ) from None
    except ForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    background_tasks.add_task(run_sync_for_user, user_id)
    return ApiResponse[TransactionResponse](
        success=True,
        message=(
            "Draft sent successfully."
            if created
            else "Transaction already exists (idempotent replay)."
        ),
        data=_to_detail_response(row),
    )
