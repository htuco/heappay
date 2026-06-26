"""Privacy helpers: admins see transaction metadata but not monetary amounts."""

from decimal import Decimal

from schemas.request import RefundRequestDetailResponse
from schemas.transaction import (
    TransactionResponse,
    TransactionStatsMonthlyPoint,
    TransactionStatsResponse,
)


def mask_transaction_response(response: TransactionResponse) -> TransactionResponse:
    response.amount = None
    response.amount_hidden = True
    return response


def mask_stats_response(response: TransactionStatsResponse) -> TransactionStatsResponse:
    response.amounts_hidden = True
    response.completed_volume = None
    for point in response.monthly:
        point.volume = None
        point.volume_hidden = True
    return response


def build_masked_stats(raw: dict) -> TransactionStatsResponse:
    """Build admin-safe platform stats (counts only, no volume)."""
    return mask_stats_response(
        TransactionStatsResponse(
            monthly=[
                TransactionStatsMonthlyPoint(
                    period=r["period"],
                    count=r["count"],
                    volume=None,
                    volume_hidden=True,
                )
                for r in raw["monthly"]
            ],
            by_status=raw["by_status"],
            by_type=raw["by_type"],
            total_count=raw["total_count"],
            completed_volume=None,
            months=raw["months"],
            amounts_hidden=True,
        )
    )


def mask_refund_detail(
    detail: RefundRequestDetailResponse | None,
) -> RefundRequestDetailResponse | None:
    if detail is None:
        return None
    detail.transaction_amount = None
    detail.transaction_amount_hidden = True
    return detail
