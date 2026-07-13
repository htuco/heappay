from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from repositories.refund_approval.refund_approval_rule import RefundApprovalRuleRepository
from routes.dependencies import require_admin
from schemas.refund_approval_rule import RefundApprovalRuleResponse, RefundApprovalRuleUpdate
from schemas.response import ApiResponse
from services.refund_approval.refund_approval_rule import RefundApprovalRuleService

router = APIRouter(prefix="/refund-approval-rules", tags=["refund-approval-rules"])


def get_refund_approval_rule_service(
    db: Session = Depends(get_db),
) -> RefundApprovalRuleService:
    return RefundApprovalRuleService(RefundApprovalRuleRepository(db))


def _to_response(rule) -> RefundApprovalRuleResponse:
    updated_by_name = None
    if rule.updated_by is not None:
        updated_by_name = f"{rule.updated_by.first_name} {rule.updated_by.last_name}".strip() or None
    return RefundApprovalRuleResponse(
        enabled=rule.enabled,
        auto_approve_max_amount=rule.auto_approve_max_amount,
        max_age_days=rule.max_age_days,
        updated_at=rule.updated_at,
        updated_by_user_id=rule.updated_by_user_id,
        updated_by_name=updated_by_name,
    )


@router.get(
    "",
    response_model=ApiResponse[RefundApprovalRuleResponse],
    summary="(Admin) Get the current refund approval rules.",
)
def get_refund_approval_rules(
    _: int = Depends(require_admin),
    service: RefundApprovalRuleService = Depends(get_refund_approval_rule_service),
) -> ApiResponse[RefundApprovalRuleResponse]:
    rule = service.get()
    return ApiResponse[RefundApprovalRuleResponse](
        success=True,
        message="Refund approval rules.",
        data=_to_response(rule),
    )


@router.put(
    "",
    response_model=ApiResponse[RefundApprovalRuleResponse],
    summary="(Admin) Update the refund approval rules.",
)
def update_refund_approval_rules(
    payload: RefundApprovalRuleUpdate,
    user_id: int = Depends(require_admin),
    service: RefundApprovalRuleService = Depends(get_refund_approval_rule_service),
) -> ApiResponse[RefundApprovalRuleResponse]:
    rule = service.update(
        enabled=payload.enabled,
        auto_approve_max_amount=payload.auto_approve_max_amount,
        max_age_days=payload.max_age_days,
        updated_by_user_id=user_id,
    )
    return ApiResponse[RefundApprovalRuleResponse](
        success=True,
        message="Refund approval rules updated.",
        data=_to_response(rule),
    )
