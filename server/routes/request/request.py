from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.request.request import RequestRepository
from routes.dependencies import get_current_user_id, require_admin
from schemas.pagination import Page
from schemas.request import RefundRequestCreate, RequestResponse
from schemas.response import ApiResponse
from services.request.request import (
    ForbiddenError,
    InsufficientBalanceError,
    NotRefundableError,
    RefundAlreadyPendingError,
    RequestNotFoundError,
    RequestService,
    TransactionNotFoundError,
)

router = APIRouter(prefix="/requests", tags=["requests"])

_NOT_FOUND = "Request not found."
_TX_NOT_FOUND = "Transaction not found."
_FORBIDDEN = "You do not have access to this resource."
_NOT_REFUNDABLE = "This transaction cannot be refunded."
_ALREADY_PENDING = "A refund request already exists for this transaction."
_INSUFFICIENT_BALANCE = "Recipient card has insufficient balance to process the refund."


def get_request_service(db: Session = Depends(get_db)) -> RequestService:
    return RequestService(RequestRepository(db))


@router.post(
    "/refund",
    response_model=ApiResponse[RequestResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_refund_request(
    payload: RefundRequestCreate,
    user_id: int = Depends(get_current_user_id),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.request_refund(
            transaction_id=payload.transaction_id,
            note=payload.note,
            user_id=user_id,
        )
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_TX_NOT_FOUND) from None
    except ForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except NotRefundableError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from None
    except RefundAlreadyPendingError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_ALREADY_PENDING) from None
    return ApiResponse[RequestResponse](
        success=True,
        message="Refund request submitted. The review team will process it.",
        data=RequestResponse.model_validate(req),
    )


@router.post(
    "/{request_id}/approve",
    response_model=ApiResponse[RequestResponse],
)
def approve_refund(
    request_id: int,
    _: int = Depends(require_admin),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.approve_refund(request_id=request_id)
    except RequestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_TX_NOT_FOUND) from None
    except InsufficientBalanceError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_INSUFFICIENT_BALANCE
        ) from None
    return ApiResponse[RequestResponse](
        success=True,
        message="Refund approved. Balance reversed.",
        data=RequestResponse.model_validate(req),
    )


@router.post(
    "/{request_id}/decline",
    response_model=ApiResponse[RequestResponse],
)
def decline_refund(
    request_id: int,
    _: int = Depends(require_admin),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.decline_refund(request_id=request_id)
    except RequestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    return ApiResponse[RequestResponse](
        success=True,
        message="Refund request declined.",
        data=RequestResponse.model_validate(req),
    )


@router.get(
    "/refunds/pending",
    response_model=ApiResponse[Page[RequestResponse]],
    summary="(Admin) List all pending refund requests.",
)
def list_pending_refunds(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: int = Depends(require_admin),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[Page[RequestResponse]]:
    items, total = service.list_pending_refunds(
        limit=page_size, offset=(page - 1) * page_size
    )
    data = Page[RequestResponse].build(
        items=[RequestResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    return ApiResponse[Page[RequestResponse]](
        success=True,
        message=f"{total} pending refund request(s).",
        data=data,
    )
