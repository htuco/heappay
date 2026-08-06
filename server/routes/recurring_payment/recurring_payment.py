from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.recurring_payment.recurring_payment import RecurringPaymentRepository
from repositories.transaction.transaction import TransactionRepository
from routes.dependencies import get_current_user_id, require_verified_user
from schemas.recurring_payment import (
    RecurringPaymentCreate,
    RecurringPaymentResponse,
    RecurringPaymentUpdate,
)
from schemas.response import ApiResponse
from services.recurring_payment.recurring_payment import (
    RecurringPaymentCardError,
    RecurringPaymentCategoryError,
    RecurringPaymentForbiddenError,
    RecurringPaymentNotFoundError,
    RecurringPaymentService,
)

router = APIRouter(prefix="/recurring-payments", tags=["recurring-payments"])

_NOT_FOUND = "Recurring payment rule not found."
_FORBIDDEN = "You do not have access to this resource."
_CARD_ERROR = "One of the referenced cards was not found or does not belong to you."
# Same wording the transaction routes use, so a bad category reads identically
# whichever surface rejected it.
_CATEGORY_NOT_FOUND = "Transaction category not found."


def get_recurring_payment_service(db: Session = Depends(get_db)) -> RecurringPaymentService:
    return RecurringPaymentService(
        RecurringPaymentRepository(db),
        TransactionRepository(db),
    )


@router.post(
    "",
    response_model=ApiResponse[RecurringPaymentResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_recurring_payment(
    payload: RecurringPaymentCreate,
    user_id: int = Depends(require_verified_user),
    service: RecurringPaymentService = Depends(get_recurring_payment_service),
) -> ApiResponse[RecurringPaymentResponse]:
    try:
        row = service.create(payload, user_id=user_id)
    except RecurringPaymentCardError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_ERROR) from None
    except RecurringPaymentCategoryError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CATEGORY_NOT_FOUND
        ) from None
    return ApiResponse[RecurringPaymentResponse](
        success=True,
        message="Recurring payment created successfully.",
        data=RecurringPaymentResponse.model_validate(row),
    )


@router.get("", response_model=ApiResponse[list[RecurringPaymentResponse]])
def list_recurring_payments(
    user_id: int = Depends(get_current_user_id),
    service: RecurringPaymentService = Depends(get_recurring_payment_service),
) -> ApiResponse[list[RecurringPaymentResponse]]:
    rows = service.list_for_user(user_id=user_id)
    return ApiResponse[list[RecurringPaymentResponse]](
        success=True,
        message="Recurring payments retrieved successfully.",
        data=[RecurringPaymentResponse.model_validate(r) for r in rows],
    )


@router.get("/{recurring_payment_id}", response_model=ApiResponse[RecurringPaymentResponse])
def get_recurring_payment(
    recurring_payment_id: int,
    user_id: int = Depends(get_current_user_id),
    service: RecurringPaymentService = Depends(get_recurring_payment_service),
) -> ApiResponse[RecurringPaymentResponse]:
    try:
        row = service.get_by_id_for_user(recurring_payment_id, user_id=user_id)
    except RecurringPaymentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except RecurringPaymentForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    return ApiResponse[RecurringPaymentResponse](
        success=True,
        message="Recurring payment retrieved successfully.",
        data=RecurringPaymentResponse.model_validate(row),
    )


@router.patch("/{recurring_payment_id}", response_model=ApiResponse[RecurringPaymentResponse])
def update_recurring_payment(
    recurring_payment_id: int,
    payload: RecurringPaymentUpdate,
    user_id: int = Depends(require_verified_user),
    service: RecurringPaymentService = Depends(get_recurring_payment_service),
) -> ApiResponse[RecurringPaymentResponse]:
    try:
        row = service.update(recurring_payment_id, payload, user_id=user_id)
    except RecurringPaymentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except RecurringPaymentForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except RecurringPaymentCategoryError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CATEGORY_NOT_FOUND
        ) from None
    return ApiResponse[RecurringPaymentResponse](
        success=True,
        message="Recurring payment updated successfully.",
        data=RecurringPaymentResponse.model_validate(row),
    )


@router.delete("/{recurring_payment_id}", response_model=ApiResponse[None])
def cancel_recurring_payment(
    recurring_payment_id: int,
    user_id: int = Depends(get_current_user_id),
    service: RecurringPaymentService = Depends(get_recurring_payment_service),
) -> ApiResponse[None]:
    try:
        service.cancel(recurring_payment_id, user_id=user_id)
    except RecurringPaymentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except RecurringPaymentForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    return ApiResponse[None](
        success=True,
        message="Recurring payment cancelled successfully.",
        data=None,
    )
