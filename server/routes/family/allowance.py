from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.user.user import UserRepository
from routes.dependencies import require_guardian_of
from schemas.family_allowance import AllowanceTransferCreate, AllowanceTransferResponse
from schemas.response import ApiResponse
from services.family.allowance import (
    AllowanceInsufficientFundsError,
    AllowanceInvalidAmountError,
    AllowanceService,
    AllowanceUserNotFoundError,
)

router = APIRouter(prefix="/family", tags=["family"])

_INVALID_AMOUNT = "Transfer amount must be greater than zero."
_INSUFFICIENT_FUNDS = "Insufficient wallet balance for this allowance transfer."
_USER_NOT_FOUND = "User not found."


def get_allowance_service(db: Session = Depends(get_db)) -> AllowanceService:
    return AllowanceService(UserRepository(db))


@router.post(
    "/dependents/{dependent_user_id}/allowance",
    response_model=ApiResponse[AllowanceTransferResponse],
    status_code=status.HTTP_201_CREATED,
)
def send_allowance(
    dependent_user_id: int,
    payload: AllowanceTransferCreate,
    guardian_user_id: int = Depends(require_guardian_of),
    service: AllowanceService = Depends(get_allowance_service),
) -> ApiResponse[AllowanceTransferResponse]:
    try:
        guardian_balance, dependent_balance = service.transfer(
            guardian_user_id=guardian_user_id,
            dependent_user_id=dependent_user_id,
            amount=payload.amount,
        )
    except AllowanceInvalidAmountError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, _INVALID_AMOUNT)
    except AllowanceInsufficientFundsError:
        raise HTTPException(status.HTTP_409_CONFLICT, _INSUFFICIENT_FUNDS)
    except AllowanceUserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _USER_NOT_FOUND)

    return ApiResponse[AllowanceTransferResponse](
        success=True,
        message="Allowance sent.",
        data=AllowanceTransferResponse(
            dependent_user_id=dependent_user_id,
            amount=payload.amount,
            guardian_wallet_balance=guardian_balance,
            dependent_wallet_balance=dependent_balance,
        ),
    )
