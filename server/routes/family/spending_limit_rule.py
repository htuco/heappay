from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.family.spending_limit_rule import SpendingLimitRuleRepository
from routes.dependencies import require_guardian_of
from schemas.response import ApiResponse
from schemas.spending_limit_rule import (
    SpendingLimitRuleCreate,
    SpendingLimitRuleResponse,
    SpendingLimitRuleUpdate,
)
from services.family.spending_limit_rule import (
    SpendingLimitRuleNotFoundError,
    SpendingLimitRuleService,
)

router = APIRouter(prefix="/family", tags=["family"])

_RULE_NOT_FOUND = "Spending limit rule not found."


def get_spending_limit_rule_service(db: Session = Depends(get_db)) -> SpendingLimitRuleService:
    return SpendingLimitRuleService(SpendingLimitRuleRepository(db))


@router.get(
    "/dependents/{dependent_user_id}/spending-limits",
    response_model=ApiResponse[list[SpendingLimitRuleResponse]],
)
def list_spending_limits(
    dependent_user_id: int,
    _guardian_user_id: int = Depends(require_guardian_of),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> ApiResponse[list[SpendingLimitRuleResponse]]:
    rules = service.list_for_dependent(dependent_user_id)
    return ApiResponse[list[SpendingLimitRuleResponse]](
        success=True,
        message="Spending limits retrieved.",
        data=[SpendingLimitRuleResponse.model_validate(r) for r in rules],
    )


@router.post(
    "/dependents/{dependent_user_id}/spending-limits",
    response_model=ApiResponse[SpendingLimitRuleResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_spending_limit(
    dependent_user_id: int,
    payload: SpendingLimitRuleCreate,
    guardian_user_id: int = Depends(require_guardian_of),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> ApiResponse[SpendingLimitRuleResponse]:
    rule = service.create(
        dependent_user_id=dependent_user_id, guardian_user_id=guardian_user_id, payload=payload
    )
    return ApiResponse[SpendingLimitRuleResponse](
        success=True,
        message="Spending limit created.",
        data=SpendingLimitRuleResponse.model_validate(rule),
    )


@router.patch(
    "/dependents/{dependent_user_id}/spending-limits/{spending_limit_rule_id}",
    response_model=ApiResponse[SpendingLimitRuleResponse],
)
def update_spending_limit(
    dependent_user_id: int,
    spending_limit_rule_id: int,
    payload: SpendingLimitRuleUpdate,
    guardian_user_id: int = Depends(require_guardian_of),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> ApiResponse[SpendingLimitRuleResponse]:
    try:
        rule = service.update(
            dependent_user_id=dependent_user_id,
            guardian_user_id=guardian_user_id,
            spending_limit_rule_id=spending_limit_rule_id,
            payload=payload,
        )
    except SpendingLimitRuleNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _RULE_NOT_FOUND)
    return ApiResponse[SpendingLimitRuleResponse](
        success=True,
        message="Spending limit updated.",
        data=SpendingLimitRuleResponse.model_validate(rule),
    )


@router.delete(
    "/dependents/{dependent_user_id}/spending-limits/{spending_limit_rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_spending_limit(
    dependent_user_id: int,
    spending_limit_rule_id: int,
    _guardian_user_id: int = Depends(require_guardian_of),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> None:
    try:
        service.delete(
            dependent_user_id=dependent_user_id, spending_limit_rule_id=spending_limit_rule_id
        )
    except SpendingLimitRuleNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _RULE_NOT_FOUND)
