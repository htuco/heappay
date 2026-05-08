from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.transaction import TransactionRepository
from routers.dependencies import get_current_user_id, require_admin
from schemas.pagination import Page
from schemas.response import ApiResponse
from schemas.transaction import (
    TransactionCreate,
    TransactionPatch,
    TransactionResponse,
    TransactionSummaryPoint,
    TransactionSummaryResponse,
)
from services.transaction import (
    CardNotFoundError,
    ForbiddenError,
    InsufficientBalanceError,
    TransactionNotFoundError,
    TransactionService,
    TransactionStatusNotFoundError,
    TransactionTypeNotFoundError,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])

_TRANSACTION_NOT_FOUND = "Transaction not found."
_CARD_NOT_FOUND = "One of the referenced cards was not found."
_TYPE_NOT_FOUND = "Transaction type not found."
_STATUS_NOT_FOUND = "Transaction status not found."
_INSUFFICIENT_BALANCE = "Sender card has insufficient balance."
_FORBIDDEN = "You do not have access to this resource."


def get_transaction_service(db: Session = Depends(get_db)) -> TransactionService:
    return TransactionService(TransactionRepository(db))


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
    items = [TransactionResponse.model_validate(r) for r in rows]
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
    _: int = Depends(require_admin),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[Page[TransactionResponse]]:
    offset = (page - 1) * page_size
    rows, total = service.list_all(limit=page_size, offset=offset)
    items = [TransactionResponse.model_validate(r) for r in rows]
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
    items = [TransactionResponse.model_validate(r) for r in rows]
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
        data=TransactionResponse.model_validate(row),
    )


@router.post(
    "",
    response_model=ApiResponse[TransactionResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    payload: TransactionCreate,
    user_id: int = Depends(get_current_user_id),
    service: TransactionService = Depends(get_transaction_service),
) -> ApiResponse[TransactionResponse]:
    try:
        row = service.create(payload, user_id=user_id)
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
    except ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        ) from None
    return ApiResponse[TransactionResponse](
        success=True,
        message="Transaction created successfully.",
        data=TransactionResponse.model_validate(row),
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
    return ApiResponse[TransactionResponse](
        success=True,
        message="Transaction updated successfully.",
        data=TransactionResponse.model_validate(row),
    )
