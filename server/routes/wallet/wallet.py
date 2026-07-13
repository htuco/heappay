from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.card.card import CardRepository
from repositories.user.user import UserRepository
from routes.dependencies import get_current_user_id
from schemas.response import ApiResponse
from schemas.wallet import (
    WalletBalanceResponse,
    WalletTransferCreate,
    WalletTransferResponse,
)
from services.wallet.wallet import (
    WalletCardFrozenError,
    WalletCardNotFoundError,
    WalletCardNotOwnedError,
    WalletInsufficientFundsError,
    WalletInvalidAmountError,
    WalletService,
    WalletUserNotFoundError,
)

router = APIRouter(prefix="/wallet", tags=["wallet"])

_CARD_NOT_FOUND = "Card not found."
_CARD_NOT_OWNED = "You do not have access to this card."
_CARD_FROZEN = "This card is frozen and cannot move money to or from your wallet."
_INSUFFICIENT_FUNDS = "Insufficient balance for this transfer."
_INVALID_AMOUNT = "Transfer amount must be greater than zero."
_USER_NOT_FOUND = "User not found."


def get_wallet_service(db: Session = Depends(get_db)) -> WalletService:
    return WalletService(UserRepository(db), CardRepository(db))


@router.get("", response_model=ApiResponse[WalletBalanceResponse])
def get_wallet_balance(
    user_id: int = Depends(get_current_user_id),
    service: WalletService = Depends(get_wallet_service),
) -> ApiResponse[WalletBalanceResponse]:
    try:
        balance = service.get_balance(user_id)
    except WalletUserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _USER_NOT_FOUND)
    return ApiResponse[WalletBalanceResponse](
        success=True,
        message="Wallet balance retrieved.",
        data=WalletBalanceResponse(wallet_balance=balance),
    )


@router.post(
    "/transfers",
    response_model=ApiResponse[WalletTransferResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_wallet_transfer(
    payload: WalletTransferCreate,
    user_id: int = Depends(get_current_user_id),
    service: WalletService = Depends(get_wallet_service),
) -> ApiResponse[WalletTransferResponse]:
    try:
        if payload.direction == "to_card":
            user = service.transfer_to_card(
                user_id=user_id, card_id=payload.card_id, amount=payload.amount
            )
        else:
            user = service.transfer_to_wallet(
                user_id=user_id, card_id=payload.card_id, amount=payload.amount
            )
    except WalletInvalidAmountError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, _INVALID_AMOUNT)
    except WalletCardNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _CARD_NOT_FOUND)
    except WalletCardNotOwnedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, _CARD_NOT_OWNED)
    except WalletCardFrozenError:
        raise HTTPException(status.HTTP_409_CONFLICT, _CARD_FROZEN)
    except WalletInsufficientFundsError:
        raise HTTPException(status.HTTP_409_CONFLICT, _INSUFFICIENT_FUNDS)
    except WalletUserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _USER_NOT_FOUND)

    return ApiResponse[WalletTransferResponse](
        success=True,
        message="Transfer completed.",
        data=WalletTransferResponse(
            direction=payload.direction,
            card_id=payload.card_id,
            amount=payload.amount,
            wallet_balance=user.wallet_balance,
        ),
    )
