from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.card.card import CardRepository
from routes.dependencies import get_current_user_id
from schemas.nexus import FundRequestCreate, FundRequestResponse
from schemas.response import ApiResponse
from services.nexus.funding import (
    CardNotFoundError,
    ForbiddenError,
    NexusFundingService,
    NexusNotConfiguredError,
    NexusRequestFailedError,
    is_nexus_configured,
)

router = APIRouter(tags=["nexus"])

_NEXUS_NOT_CONFIGURED = "Nexus funding is not configured on this server."
_NEXUS_REQUEST_FAILED = "Could not submit the funding request. Try again later."
_CARD_NOT_FOUND = "Card not found."
_FORBIDDEN = "You do not have access to this card."


def get_nexus_funding_service(db: Session = Depends(get_db)) -> NexusFundingService:
    return NexusFundingService(CardRepository(db))


def _to_fund_response(raw: dict) -> FundRequestResponse:
    return FundRequestResponse(
        id=str(raw["id"]),
        status=str(raw.get("status", "requested")),
        amount=Decimal(str(raw["amount"])),
        currency=raw.get("currency"),
        note=raw.get("note"),
        external_ref=raw.get("external_ref"),
        project=raw.get("project"),
        created_at=raw.get("created_at"),
    )


@router.get("/fund-requests/config", response_model=ApiResponse[dict])
def fund_request_config() -> ApiResponse[dict]:
    return ApiResponse[dict](
        success=True,
        message="Nexus funding configuration.",
        data={"enabled": is_nexus_configured()},
    )


@router.post(
    "/cards/{card_id}/fund-request",
    response_model=ApiResponse[FundRequestResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_fund_request(
    card_id: int,
    payload: FundRequestCreate,
    user_id: int = Depends(get_current_user_id),
    service: NexusFundingService = Depends(get_nexus_funding_service),
) -> ApiResponse[FundRequestResponse]:
    try:
        raw = await service.request_funds_for_card(
            card_id=card_id,
            amount=payload.amount,
            user_id=user_id,
        )
    except NexusNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_NEXUS_NOT_CONFIGURED,
        ) from None
    except CardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_CARD_NOT_FOUND
        ) from None
    except ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        ) from None
    except NexusRequestFailedError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=_NEXUS_REQUEST_FAILED
        ) from None

    return ApiResponse[FundRequestResponse](
        success=True,
        message="Funding request submitted. Balance updates after operator approval.",
        data=_to_fund_response(raw),
    )


@router.get(
    "/fund-requests/{request_id}",
    response_model=ApiResponse[FundRequestResponse],
)
async def get_fund_request(
    request_id: str,
    _: int = Depends(get_current_user_id),
    service: NexusFundingService = Depends(get_nexus_funding_service),
) -> ApiResponse[FundRequestResponse]:
    try:
        raw = await service.get_request(request_id)
    except NexusNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_NEXUS_NOT_CONFIGURED,
        ) from None

    if raw is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Funding request not found."
        )

    return ApiResponse[FundRequestResponse](
        success=True,
        message="Funding request retrieved.",
        data=_to_fund_response(raw),
    )
