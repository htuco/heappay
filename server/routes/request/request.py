from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.request.request import RequestRepository
from routes.dependencies import (
    get_current_user_id,
    get_user_context,
    require_admin,
    require_staff,
    require_verified_user,
)
from schemas.pagination import Page
from schemas.request import (
    CardFreezeRequestCreate,
    CardFreezeRequestDetailResponse,
    RefundRequestCreate,
    RefundRequestDetailResponse,
    RequestResponse,
    RequestStatsResponse,
)
from schemas.response import ApiResponse
from services.request.request import (
    CardAlreadyFrozenError,
    CardNotFoundError,
    CardNotFrozenError,
    CardStatusNotFoundError,
    ForbiddenError,
    FreezeRequestAlreadyPendingError,
    InsufficientBalanceError,
    NotRefundableError,
    RefundAlreadyExistsError,
    RequestNotFoundError,
    RequestNotPendingError,
    RequestService,
    RequestStatusNotFoundError,
    TransactionNotFoundError,
)
from utils.transaction_privacy import mask_refund_detail
from utils.audit_log import (
    EVENT_FREEZE_APPROVED,
    EVENT_FREEZE_DECLINED,
    EVENT_REFUND_APPROVED,
    EVENT_REFUND_DECLINED,
    EVENT_UNFREEZE_APPROVED,
    EVENT_UNFREEZE_DECLINED,
    record_audit_log,
)

router = APIRouter(prefix="/requests", tags=["requests"])

_NOT_FOUND = "Request not found."
_TX_NOT_FOUND = "Transaction not found."
_STATUS_NOT_FOUND = "Request status not found."
_FORBIDDEN = "You do not have access to this resource."
_NOT_REFUNDABLE = "This transaction cannot be refunded."
# Status-aware messages for the "one refund per transaction" rule.
_REFUND_EXISTS_BY_STATUS = {
    "pending": "A refund request for this transaction is already under review.",
    "approved": "This transaction has already been refunded.",
    "declined": "A refund for this transaction was declined. That decision is final.",
    "cancelled": "A refund request for this transaction was already cancelled.",
}
_REFUND_EXISTS_DEFAULT = "A refund request already exists for this transaction."
_INSUFFICIENT_BALANCE = "Recipient card has insufficient balance to process the refund."
_CARD_NOT_FOUND = "Card not found."
_CARD_ALREADY_FROZEN = "This card is already frozen."
_CARD_NOT_FROZEN = "This card is not frozen."
_FREEZE_PENDING = "A freeze request for this card is already under review."
_UNFREEZE_PENDING = "An unfreeze request for this card is already under review."
_CARD_STATUS_NOT_FOUND = "The frozen card status is not configured."


def get_request_service(db: Session = Depends(get_db)) -> RequestService:
    return RequestService(RequestRepository(db))


def _log_request_decision(
    db: Session,
    *,
    actor_user_id: int,
    event_type: str,
    req,
) -> None:
    record_audit_log(
        db,
        event_type=event_type,
        actor_user_id=actor_user_id,
        target_user_id=req.requester_user_id,
        resource_type="request",
        resource_id=req.request_id,
        detail=req.note,
    )


def _user_name(user) -> str | None:
    if user is None:
        return None
    return f"{user.first_name} {user.last_name}".strip() or None


def _to_response(req, *, mask_amounts: bool = False) -> RequestResponse:
    detail = None
    if req.refund_detail is not None:
        tx = req.refund_detail.transaction
        sender_name = None
        recipient_name = None
        if tx is not None:
            if tx.sender_card is not None:
                sender_name = tx.sender_card.cardholder_name
            if tx.recipient_card is not None:
                recipient_name = tx.recipient_card.cardholder_name
        detail = RefundRequestDetailResponse(
            request_id=req.refund_detail.request_id,
            transaction_id=req.refund_detail.transaction_id,
            reason_code=req.refund_detail.reason_code,
            transaction_amount=tx.amount if tx is not None else None,
            transaction_note=tx.note if tx is not None else None,
            sender_name=sender_name,
            recipient_name=recipient_name,
        )
        if mask_amounts:
            mask_refund_detail(detail)

    freeze_detail = None
    card_freeze = getattr(req, "card_freeze_detail", None)
    if card_freeze is not None:
        card = card_freeze.card
        freeze_detail = CardFreezeRequestDetailResponse(
            request_id=card_freeze.request_id,
            card_id=card_freeze.card_id,
            card_last_four=card.last_four if card is not None else None,
            cardholder_name=card.cardholder_name if card is not None else None,
        )

    request_type_name = None
    req_type = getattr(req, "request_type", None)
    if req_type is not None:
        request_type_name = req_type.name

    return RequestResponse(
        request_id=req.request_id,
        request_type_id=req.request_type_id,
        request_type_name=request_type_name,
        request_status_id=req.request_status_id,
        requester_user_id=req.requester_user_id,
        requester_name=_user_name(req.requester),
        target_user_id=req.target_user_id,
        note=req.note,
        created_at=req.created_at,
        resolved_at=req.resolved_at,
        refund_detail=detail,
        card_freeze_detail=freeze_detail,
    )


@router.post(
    "/refund",
    response_model=ApiResponse[RequestResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_refund_request(
    payload: RefundRequestCreate,
    user_id: int = Depends(require_verified_user),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.request_refund(
            transaction_id=payload.transaction_id,
            reason_code=payload.reason_code,
            note=payload.note,
            user_id=user_id,
        )
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_TX_NOT_FOUND) from None
    except ForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except NotRefundableError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from None
    except RefundAlreadyExistsError as exc:
        detail = _REFUND_EXISTS_BY_STATUS.get(exc.status, _REFUND_EXISTS_DEFAULT)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from None
    return ApiResponse[RequestResponse](
        success=True,
        message="Refund request submitted. The review team will process it.",
        data=_to_response(req),
    )


@router.post(
    "/{request_id}/approve",
    response_model=ApiResponse[RequestResponse],
)
def approve_refund(
    request_id: int,
    actor_id: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    db: Session = Depends(get_db),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.approve_refund(request_id=request_id)
    except RequestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except RequestNotPendingError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    except TransactionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_TX_NOT_FOUND) from None
    except InsufficientBalanceError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_INSUFFICIENT_BALANCE
        ) from None
    _log_request_decision(db, actor_user_id=actor_id, event_type=EVENT_REFUND_APPROVED, req=req)
    return ApiResponse[RequestResponse](
        success=True,
        message="Refund approved. Balance reversed.",
        data=_to_response(req, mask_amounts=ctx.is_admin),
    )


@router.post(
    "/{request_id}/decline",
    response_model=ApiResponse[RequestResponse],
)
def decline_refund(
    request_id: int,
    actor_id: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    db: Session = Depends(get_db),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.decline_refund(request_id=request_id)
    except RequestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except RequestNotPendingError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    _log_request_decision(db, actor_user_id=actor_id, event_type=EVENT_REFUND_DECLINED, req=req)
    return ApiResponse[RequestResponse](
        success=True,
        message="Refund request declined.",
        data=_to_response(req, mask_amounts=ctx.is_admin),
    )


@router.post(
    "/card-freeze",
    response_model=ApiResponse[RequestResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_card_freeze_request(
    payload: CardFreezeRequestCreate,
    user_id: int = Depends(require_verified_user),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.request_card_freeze(
            card_id=payload.card_id,
            note=payload.note,
            user_id=user_id,
        )
    except CardNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND) from None
    except ForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except CardAlreadyFrozenError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_CARD_ALREADY_FROZEN) from None
    except FreezeRequestAlreadyPendingError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_FREEZE_PENDING) from None
    except CardStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_CARD_STATUS_NOT_FOUND
        ) from None
    return ApiResponse[RequestResponse](
        success=True,
        message="Freeze request submitted. The review team will process it.",
        data=_to_response(req),
    )


@router.post(
    "/{request_id}/approve-freeze",
    response_model=ApiResponse[RequestResponse],
)
def approve_card_freeze(
    request_id: int,
    actor_id: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    db: Session = Depends(get_db),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.approve_card_freeze(request_id=request_id)
    except RequestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except RequestNotPendingError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    except CardStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_CARD_STATUS_NOT_FOUND
        ) from None
    _log_request_decision(db, actor_user_id=actor_id, event_type=EVENT_FREEZE_APPROVED, req=req)
    return ApiResponse[RequestResponse](
        success=True,
        message="Freeze approved. The card is now frozen.",
        data=_to_response(req, mask_amounts=ctx.is_admin),
    )


@router.post(
    "/{request_id}/decline-freeze",
    response_model=ApiResponse[RequestResponse],
)
def decline_card_freeze(
    request_id: int,
    actor_id: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    db: Session = Depends(get_db),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.decline_card_freeze(request_id=request_id)
    except RequestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except RequestNotPendingError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    _log_request_decision(db, actor_user_id=actor_id, event_type=EVENT_FREEZE_DECLINED, req=req)
    return ApiResponse[RequestResponse](
        success=True,
        message="Freeze request declined.",
        data=_to_response(req, mask_amounts=ctx.is_admin),
    )


@router.post(
    "/card-unfreeze",
    response_model=ApiResponse[RequestResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_card_unfreeze_request(
    payload: CardFreezeRequestCreate,
    user_id: int = Depends(require_verified_user),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.request_card_unfreeze(
            card_id=payload.card_id,
            note=payload.note,
            user_id=user_id,
        )
    except CardNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND) from None
    except ForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except CardNotFrozenError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_CARD_NOT_FROZEN) from None
    except FreezeRequestAlreadyPendingError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_UNFREEZE_PENDING) from None
    except CardStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_CARD_STATUS_NOT_FOUND
        ) from None
    return ApiResponse[RequestResponse](
        success=True,
        message="Unfreeze request submitted. The review team will process it.",
        data=_to_response(req),
    )


@router.post(
    "/{request_id}/approve-unfreeze",
    response_model=ApiResponse[RequestResponse],
)
def approve_card_unfreeze(
    request_id: int,
    actor_id: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    db: Session = Depends(get_db),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.approve_card_unfreeze(request_id=request_id)
    except RequestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except RequestNotPendingError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    except CardStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_CARD_STATUS_NOT_FOUND
        ) from None
    _log_request_decision(db, actor_user_id=actor_id, event_type=EVENT_UNFREEZE_APPROVED, req=req)
    return ApiResponse[RequestResponse](
        success=True,
        message="Unfreeze approved. The card is now active.",
        data=_to_response(req, mask_amounts=ctx.is_admin),
    )


@router.post(
    "/{request_id}/decline-unfreeze",
    response_model=ApiResponse[RequestResponse],
)
def decline_card_unfreeze(
    request_id: int,
    actor_id: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    db: Session = Depends(get_db),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestResponse]:
    try:
        req = service.decline_card_unfreeze(request_id=request_id)
    except RequestNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except RequestNotPendingError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    _log_request_decision(db, actor_user_id=actor_id, event_type=EVENT_UNFREEZE_DECLINED, req=req)
    return ApiResponse[RequestResponse](
        success=True,
        message="Unfreeze request declined.",
        data=_to_response(req, mask_amounts=ctx.is_admin),
    )


@router.get(
    "/freezes",
    response_model=ApiResponse[Page[RequestResponse]],
    summary="(Staff) List card freeze requests, optionally filtered by status.",
)
def list_freezes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_id: int | None = Query(default=None, ge=1),
    _: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[Page[RequestResponse]]:
    try:
        items, total = service.list_freezes(
            limit=page_size,
            offset=(page - 1) * page_size,
            status_id=status_id,
        )
    except RequestStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    data = Page[RequestResponse].build(
        items=[_to_response(r, mask_amounts=ctx.is_admin) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    return ApiResponse[Page[RequestResponse]](
        success=True,
        message=f"{total} card freeze request(s).",
        data=data,
    )


@router.get(
    "/user/{user_id}",
    response_model=ApiResponse[Page[RequestResponse]],
    summary="(Staff) List refund requests for a specific user.",
)
def list_requests_for_user(
    user_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[Page[RequestResponse]]:
    items, total = service.list_for_user(
        user_id=user_id, limit=page_size, offset=(page - 1) * page_size
    )
    data = Page[RequestResponse].build(
        items=[_to_response(r, mask_amounts=ctx.is_admin) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    return ApiResponse[Page[RequestResponse]](
        success=True,
        message=f"{total} refund request(s) for user {user_id}.",
        data=data,
    )


@router.get(
    "/refunds/pending",
    response_model=ApiResponse[Page[RequestResponse]],
    summary="(Admin) List all pending refund requests.",
)
def list_pending_refunds(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[Page[RequestResponse]]:
    items, total = service.list_pending_refunds(
        limit=page_size, offset=(page - 1) * page_size
    )
    data = Page[RequestResponse].build(
        items=[_to_response(r, mask_amounts=ctx.is_admin) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    return ApiResponse[Page[RequestResponse]](
        success=True,
        message=f"{total} pending refund request(s).",
        data=data,
    )


@router.get(
    "/stats",
    response_model=ApiResponse[RequestStatsResponse],
    summary="(Staff) Refund request counts by status.",
)
def get_request_stats(
    _: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[RequestStatsResponse]:
    stats = service.get_refund_stats()
    return ApiResponse[RequestStatsResponse](
        success=True,
        message="Refund request statistics.",
        data=RequestStatsResponse(**stats),
    )


@router.get(
    "",
    response_model=ApiResponse[Page[RequestResponse]],
    summary="(Staff) List refund requests, optionally filtered by status.",
)
def list_refunds(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_id: int | None = Query(default=None, ge=1),
    _: int = Depends(require_staff),
    ctx=Depends(get_user_context),
    service: RequestService = Depends(get_request_service),
) -> ApiResponse[Page[RequestResponse]]:
    try:
        items, total = service.list_refunds(
            limit=page_size,
            offset=(page - 1) * page_size,
            status_id=status_id,
        )
    except RequestStatusNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_STATUS_NOT_FOUND
        ) from None
    data = Page[RequestResponse].build(
        items=[_to_response(r, mask_amounts=ctx.is_admin) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    return ApiResponse[Page[RequestResponse]](
        success=True,
        message=f"{total} refund request(s).",
        data=data,
    )
