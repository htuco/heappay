from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from routes.dependencies import get_current_user_id
from schemas.fx import (
    FxConvertResponse,
    FxCurrenciesResponse,
    FxInsightResponse,
    FxRateResponse,
    FxRatesResponse,
)
from schemas.response import ApiResponse
from services.fx.fx import FxError, FxService

router = APIRouter(prefix="/fx", tags=["fx"])

_INSIGHT_RANGES = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}

# Single shared instance so the in-memory rate cache is reused across requests
# (a fresh FxService per request would defeat caching). It holds no request
# state and guards its cache with a lock, so it is safe to share.
_fx_service = FxService()


def get_fx_service() -> FxService:
    return _fx_service


@router.get("/convert", response_model=ApiResponse[FxConvertResponse])
def convert_currency(
    amount: Decimal = Query(..., gt=0, description="Amount to convert; must be greater than zero."),
    from_currency: str = Query(
        ..., min_length=3, max_length=3, description="ISO 4217 source currency code, e.g. EUR."
    ),
    to_currency: str = Query(
        ..., min_length=3, max_length=3, description="ISO 4217 target currency code, e.g. USD."
    ),
    user_id: int = Depends(get_current_user_id),
    service: FxService = Depends(get_fx_service),
) -> ApiResponse[FxConvertResponse]:
    """Indicative currency conversion — informational only, moves no money."""
    try:
        result = service.convert(
            amount=amount, from_currency=from_currency, to_currency=to_currency
        )
    except FxError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    return ApiResponse[FxConvertResponse](
        success=True,
        message="Indicative conversion computed.",
        data=FxConvertResponse(**result),
    )


@router.get("/rate", response_model=ApiResponse[FxRateResponse])
def pair_rate(
    from_currency: str = Query(
        ..., min_length=3, max_length=3, description="ISO 4217 source currency code."
    ),
    to_currency: str = Query(
        ..., min_length=3, max_length=3, description="ISO 4217 target currency code."
    ),
    user_id: int = Depends(get_current_user_id),
    service: FxService = Depends(get_fx_service),
) -> ApiResponse[FxRateResponse]:
    """The rate for one pair, without an amount.

    The display-currency switcher fetches this once per (stored -> displayed)
    pair and formats every amount client-side; /convert would be one request
    per rendered figure.
    """
    try:
        result = service.rate(from_currency=from_currency, to_currency=to_currency)
    except FxError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    return ApiResponse[FxRateResponse](
        success=True,
        message="Indicative rate retrieved.",
        data=FxRateResponse(**result),
    )


@router.get("/currencies", response_model=ApiResponse[FxCurrenciesResponse])
def supported_currencies(
    user_id: int = Depends(get_current_user_id),
    service: FxService = Depends(get_fx_service),
) -> ApiResponse[FxCurrenciesResponse]:
    """Currencies conversion can actually price — drives the display picker."""
    return ApiResponse[FxCurrenciesResponse](
        success=True,
        message="Supported currencies retrieved.",
        data=FxCurrenciesResponse(**service.supported_currencies()),
    )


@router.get("/rates", response_model=ApiResponse[FxRatesResponse])
def rate_overview(
    user_id: int = Depends(get_current_user_id),
    service: FxService = Depends(get_fx_service),
) -> ApiResponse[FxRatesResponse]:
    """Live reference rates for popular currencies against the euro."""
    overview = service.rate_overview()
    return ApiResponse[FxRatesResponse](
        success=True,
        message="Reference rates retrieved.",
        data=FxRatesResponse(**overview),
    )


@router.get("/insight", response_model=ApiResponse[FxInsightResponse])
def pair_insight(
    from_currency: str = Query(
        ..., min_length=3, max_length=3, description="ISO 4217 source currency code."
    ),
    to_currency: str = Query(
        ..., min_length=3, max_length=3, description="ISO 4217 target currency code."
    ),
    range_: str = Query(
        "7d",
        alias="range",
        pattern="^(7d|30d|90d|1y)$",
        description="History window: 7d, 30d, 90d, or 1y.",
    ),
    user_id: int = Depends(get_current_user_id),
    service: FxService = Depends(get_fx_service),
) -> ApiResponse[FxInsightResponse]:
    """Recent real history for a pair — line-chart points, movement, and range."""
    insight = service.pair_insight(
        from_currency=from_currency,
        to_currency=to_currency,
        days=_INSIGHT_RANGES[range_],
    )
    return ApiResponse[FxInsightResponse](
        success=True,
        message="Exchange insight retrieved.",
        data=FxInsightResponse(**insight),
    )
