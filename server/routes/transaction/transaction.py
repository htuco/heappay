from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from database import get_db
from ratelimit import TRANSACTION_RATE_LIMIT, limiter, user_id_key_func
from repositories.transaction.transaction import TransactionRepository
from repositories.user.auth import UserAuthRepository
from routes.dependencies import get_current_user_id, require_admin, require_staff
from schemas.pagination import Page
from schemas.response import ApiResponse
from schemas.transaction import (
    PaymentApprovalEventResponse,
    TransactionApproveRequest,
    TransactionCreate,
    TransactionPartyResponse,
    TransactionPatch,
    TransactionResponse,
    TransactionStatsMonthlyPoint,
    TransactionStatsResponse,
    TransactionSummaryPoint,
    TransactionSummaryResponse,
)
from tasks.sync import run_sync_for_user
from services.storage.avatar_display_url import resolve_avatar_url_for_client
from services.transaction.transaction import (
    ApprovalExpiredError,
    ApprovalRequiredError,
    CardFrozenError,
    CardNotFoundError,
    DuplicatePaymentError,
    ForbiddenError,
    InsufficientBalanceError,
    InvalidTransactionTransitionError,
    ProcessingDelayNotElapsedError,
    TransactionNotFoundError,
    TransactionService,
    TransactionStatusNotFoundError,
    TransactionTypeNotFoundError,
)
from settings import get_settings

router = APIRouter(prefix="/transactions", tags=["transactions"])

_TRANSACTION_NOT_FOUND = "Transaction not found."
_CARD_NOT_FOUND = "One of the referenced cards was not found."
_TYPE_NOT_FOUND = "Transaction type not found."
_STATUS_NOT_FOUND = "Transaction status not found."
_INSUFFICIENT_BALANCE = "Sender card has insufficient balance."
_FORBIDDEN = "You do not have access to this resource."
_SENDER_CARD_FROZEN = "This card is frozen and can't be used to send money."
_RECIPIENT_CARD_FROZEN = "The recipient's card is frozen and can't receive money."
_INVALID_TRANSITION = "This status change is not allowed for the transaction."
_PROCESSING_DELAY = "The transaction is still being processed. Try again shortly."
_DUPLICATE_PAYMENT = "A similar payment to this recipient was already submitted. Please wait before trying again."
_APPROVAL_REQUIRED = "Step-up verification failed or approval is not allowed."
_APPROVAL_EXPIRED = "The approval window has expired. Cancel and try again."


def get_transaction_service(db: Session = Depends(get_db)) -> TransactionService:
    return TransactionService(
        TransactionRepository(db),
        auth_repo=UserAuthRepository(db),
    )


def _card_to_party(card) -> TransactionPartyResponse | None:
    if card is None:
        return None
    user = card.user
    settings = get_settings()
    return TransactionPartyResponse(
        card_id=card.card_id,
        last_four=card.last_four,
        brand=card.card_type.vendor if card.card_type else None,
        cardholder_name=card.cardholder_name,
        user_id=user.user_id if user else 0,
        email=user.email if user else None,
        avatar_url=resolve_avatar_url_for_client(user.avatar_url, settings) if user else None,
        first_name=user.first_name if user else None,
        last_name=user.last_name if user else None,
    )


def _to_detail_response(row) -> TransactionResponse:
    base = TransactionResponse.model_validate(row)
    base.sender = _card_to_party(row.sender_card)
    base.recipient = _card_to_party(row.recipient_card)
    return base


@router.get("", response_model=ApiResponse[Page[TransactionResponse]])
def list_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[Page[TransactionResponse]]:
    offset = (page - 1) * page_size
    rows, total = service.list_for_user(
        user_id=user_id, limit=page_size, offset=offset
    )
    items = [_to_detail_response(r) for r in rows]
    page_data = Page[TransactionResponse].build(
        items=items, total=total, page=page, page_size=page_size
    )
    message = (
        "No transactions found."
        if total == 0
        else f"Retrieved {len(items)} of {total} transactions."
    )
    return ApiResponse[Page[TransactionResponse]](
        success=True, message=message, data=page_data
    )


@router.get(
    "/all",
    response_model=ApiResponse[Page[TransactionResponse]],
    summary="(Admin) List every transaction in the system.",
)
def list_all_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_id: int | None = Query(default=None, ge=1),
    transaction_type_id: int | None = Query(default=None, ge=1),
    sort: str = Query(
        default="newest",
        pattern="^(newest|oldest|amount_desc|amount_asc)$",
    ),
    _: int = Depends(require_admin),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[Page[TransactionResponse]]:
    offset = (page - 1) * page_size
    try:
        rows, total = service.list_all(
            limit=page_size,
            offset=offset,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            sort=sort,
        )
    except TransactionStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    except TransactionTypeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TYPE_NOT_FOUND
        ) from None
    items = [_to_detail_response(r) for r in rows]
    page_data = Page[TransactionResponse].build(
        items=items, total=total, page=page, page_size=page_size
    )
    message = (
        "No transactions in the system."
        if total == 0
        else f"Retrieved {len(items)} of {total} transactions."
    )
    return ApiResponse[Page[TransactionResponse]](
        success=True, message=message, data=page_data
    )


@router.get(
    "/stats",
    response_model=ApiResponse[TransactionStatsResponse],
    summary="(Admin) Platform-wide transaction statistics.",
)
def get_transaction_stats(
    months: int = Query(default=6, ge=1, le=24),
    _: int = Depends(require_admin),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[TransactionStatsResponse]:
    raw = service.get_platform_stats(months=months)
    data = TransactionStatsResponse(
        monthly=[
            TransactionStatsMonthlyPoint(
                period=r["period"],
                count=r["count"],
                volume=r["volume"],
            )
            for r in raw["monthly"]
        ],
        by_status=raw["by_status"],
        by_type=raw["by_type"],
        total_count=raw["total_count"],
        completed_volume=raw["completed_volume"],
        months=raw["months"],
    )
    return ApiResponse[TransactionStatsResponse](
        success=True,
        message=f"Transaction stats for the last {months} month(s).",
        data=data,
    )


@router.get(
    "/user/{user_id}",
    response_model=ApiResponse[Page[TransactionResponse]],
    summary="(Staff) List transactions for a specific user.",
)
def list_transactions_for_user(
    user_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    status_id: int | None = Query(default=None, ge=1),
    transaction_type_id: int | None = Query(default=None, ge=1),
    sort: str = Query(
        default="newest",
        pattern="^(newest|oldest|amount_desc|amount_asc)$",
    ),
    _: int = Depends(require_staff),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[Page[TransactionResponse]]:
    try:
        rows, total = service.list_for_user(
            user_id=user_id,
            limit=page_size,
            offset=(page - 1) * page_size,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            sort=sort,
        )
    except TransactionStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    except TransactionTypeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TYPE_NOT_FOUND
        ) from None
    items = [_to_detail_response(r) for r in rows]
    page_data = Page[TransactionResponse].build(
        items=items, total=total, page=page, page_size=page_size
    )
    return ApiResponse[Page[TransactionResponse]](
        success=True,
        message=f"Retrieved {len(items)} of {total} transactions.",
        data=page_data,
    )


@router.patch(
    "/{transaction_id}/staff",
    response_model=ApiResponse[TransactionResponse],
    summary="(Staff) Update a transaction.",
)
def patch_transaction_as_staff(
    transaction_id: int,
    payload: TransactionPatch,
    _: int = Depends(require_staff),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[TransactionResponse]:
    try:
        row = service.patch_as_staff(transaction_id, payload)
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TRANSACTION_NOT_FOUND
        ) from None
    except TransactionStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    except InvalidTransactionTransitionError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_TRANSITION
        ) from None
    except ProcessingDelayNotElapsedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_PROCESSING_DELAY
        ) from None
    return ApiResponse[TransactionResponse](
        success=True,
        message="Transaction updated successfully.",
        data=_to_detail_response(row),
    )


@router.get(
    "/{transaction_id}/staff",
    response_model=ApiResponse[TransactionResponse],
    summary="(Staff) Look up any transaction by id.",
)
def get_transaction_as_staff(
    transaction_id: int,
    _: int = Depends(require_staff),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[TransactionResponse]:
    row = service.get_by_id_staff(transaction_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TRANSACTION_NOT_FOUND
        )
    return ApiResponse[TransactionResponse](
        success=True,
        message="Transaction retrieved successfully.",
        data=_to_detail_response(row),
    )


@router.get("/summary", response_model=ApiResponse[TransactionSummaryResponse])
def get_transaction_summary(
    months: int = Query(default=6, ge=1, le=24),
    user_id: int = Depends(get_current_user_id),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[TransactionSummaryResponse]:
    raw = service.get_summary_for_user(user_id=user_id, months=months)
    points = [
        TransactionSummaryPoint(
            period=r["period"],
            income=r["income"],
            expense=r["expense"],
        )
        for r in raw
    ]
    return ApiResponse[TransactionSummaryResponse](
        success=True,
        message=f"Transaction summary for the last {months} month(s).",
        data=TransactionSummaryResponse(points=points, months=months),
    )


@router.get("/card/{card_id}", response_model=ApiResponse[Page[TransactionResponse]])
def list_transactions_for_card(
    card_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[Page[TransactionResponse]]:
    try:
        rows, total = service.list_for_card(
            card_id, user_id=user_id, limit=page_size, offset=(page - 1) * page_size
        )
    except CardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND
        ) from None
    except ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        ) from None
    items = [_to_detail_response(r) for r in rows]
    page_data = Page[TransactionResponse].build(
        items=items, total=total, page=page, page_size=page_size
    )
    message = (
        "No transactions found for this card."
        if total == 0
        else f"Retrieved {len(items)} of {total} transactions."
    )
    return ApiResponse[Page[TransactionResponse]](
        success=True, message=message, data=page_data
    )


@router.get("/{transaction_id}", response_model=ApiResponse[TransactionResponse])
def get_transaction(
    transaction_id: int,
    user_id: int = Depends(get_current_user_id),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[TransactionResponse]:
    try:
        row = service.get_by_id_for_user(transaction_id, user_id=user_id)
    except ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        ) from None
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TRANSACTION_NOT_FOUND
        )
    return ApiResponse[TransactionResponse](
        success=True,
        message="Transaction retrieved successfully.",
        data=_to_detail_response(row),
    )


@router.post(
    "",
    response_model=ApiResponse[TransactionResponse],
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(TRANSACTION_RATE_LIMIT, key_func=user_id_key_func)
def create_transaction(
    request: Request,
    payload: TransactionCreate,
    response: Response,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[TransactionResponse]:
    try:
        row, created = service.create(payload, user_id=user_id)
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
    except InsufficientBalanceError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_INSUFFICIENT_BALANCE
        ) from None
    except CardFrozenError as exc:
        detail = _SENDER_CARD_FROZEN if exc.side == "sender" else _RECIPIENT_CARD_FROZEN
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=detail
        ) from None
    except DuplicatePaymentError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_PAYMENT
        ) from None
    except ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        ) from None
    response.status_code = (
        status.HTTP_201_CREATED if created else status.HTTP_200_OK
    )
    background_tasks.add_task(run_sync_for_user, user_id)
    return ApiResponse[TransactionResponse](
        success=True,
        message=(
            "Transaction created successfully."
            if created
            else "Transaction already exists (idempotent replay)."
        ),
        data=_to_detail_response(row),
    )


@router.post(
    "/{transaction_id}/approve",
    response_model=ApiResponse[TransactionResponse],
    summary="Confirm a sensitive pending payment with step-up verification.",
)
def approve_transaction(
    transaction_id: int,
    payload: TransactionApproveRequest,
    user_id: int = Depends(get_current_user_id),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[TransactionResponse]:
    try:
        row = service.approve(transaction_id, payload, user_id=user_id)
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TRANSACTION_NOT_FOUND
        ) from None
    except ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        ) from None
    except ApprovalExpiredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_APPROVAL_EXPIRED
        ) from None
    except ApprovalRequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc) or _APPROVAL_REQUIRED
        ) from None
    return ApiResponse[TransactionResponse](
        success=True,
        message="Payment approved. It will settle shortly.",
        data=_to_detail_response(row),
    )


@router.get(
    "/{transaction_id}/approval-events",
    response_model=ApiResponse[list[PaymentApprovalEventResponse]],
    summary="Audit trail for in-app payment approval.",
)
def list_payment_approval_events(
    transaction_id: int,
    user_id: int = Depends(get_current_user_id),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[list[PaymentApprovalEventResponse]]:
    try:
        events = service.list_approval_events(transaction_id, user_id=user_id)
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TRANSACTION_NOT_FOUND
        ) from None
    except ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        ) from None
    items = [PaymentApprovalEventResponse.model_validate(e) for e in events]
    return ApiResponse[list[PaymentApprovalEventResponse]](
        success=True,
        message=f"Retrieved {len(items)} approval event(s).",
        data=items,
    )


@router.patch("/{transaction_id}", response_model=ApiResponse[TransactionResponse])
def patch_transaction(
    transaction_id: int,
    payload: TransactionPatch,
    user_id: int = Depends(get_current_user_id),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[TransactionResponse]:
    try:
        row = service.patch(transaction_id, payload, user_id=user_id)
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_TRANSACTION_NOT_FOUND
        ) from None
    except TransactionStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    except ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        ) from None
    except InvalidTransactionTransitionError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_TRANSITION
        ) from None
    except ProcessingDelayNotElapsedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_PROCESSING_DELAY
        ) from None
    return ApiResponse[TransactionResponse](
        success=True,
        message="Transaction updated successfully.",
        data=_to_detail_response(row),
    )
