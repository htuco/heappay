from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.family.family_card_member import FamilyCardMemberRepository
from repositories.family.spending_limit_rule import SpendingLimitRuleRepository
from routes.dependencies import require_owns_card
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
_MEMBER_NOT_FOUND = "This person is not a member of this card."


def get_spending_limit_rule_service(db: Session = Depends(get_db)) -> SpendingLimitRuleService:
    return SpendingLimitRuleService(SpendingLimitRuleRepository(db))


def _require_card_member(db: Session, *, card_id: int, dependent_user_id: int) -> None:
    """`require_owns_card` only proves the caller owns `card_id` -- it says
    nothing about whether `dependent_user_id` is actually a member of it, so
    this closes that gap (mirrors `_require_dependents_card` in
    `routes/family/card.py`)."""
    if not FamilyCardMemberRepository(db).is_member(
        card_id=card_id, dependent_user_id=dependent_user_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, _MEMBER_NOT_FOUND)


# ─── Overall cap on the shared card ─────────────────────────────────────────


@router.get(
    "/cards/{card_id}/spending-limits",
    response_model=ApiResponse[list[SpendingLimitRuleResponse]],
    summary="(Guardian) List the shared card's overall spending limits.",
)
def list_card_spending_limits(
    card_id: int,
    _owner_user_id: int = Depends(require_owns_card),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> ApiResponse[list[SpendingLimitRuleResponse]]:
    rules = service.list_for_card(card_id)
    return ApiResponse[list[SpendingLimitRuleResponse]](
        success=True,
        message="Spending limits retrieved.",
        data=[SpendingLimitRuleResponse.model_validate(r) for r in rules],
    )


@router.post(
    "/cards/{card_id}/spending-limits",
    response_model=ApiResponse[SpendingLimitRuleResponse],
    status_code=status.HTTP_201_CREATED,
    summary="(Guardian) Set an overall spending limit on the shared card.",
)
def create_card_spending_limit(
    card_id: int,
    payload: SpendingLimitRuleCreate,
    owner_user_id: int = Depends(require_owns_card),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> ApiResponse[SpendingLimitRuleResponse]:
    rule = service.create_for_card(card_id=card_id, guardian_user_id=owner_user_id, payload=payload)
    return ApiResponse[SpendingLimitRuleResponse](
        success=True,
        message="Spending limit created.",
        data=SpendingLimitRuleResponse.model_validate(rule),
    )


@router.patch(
    "/cards/{card_id}/spending-limits/{spending_limit_rule_id}",
    response_model=ApiResponse[SpendingLimitRuleResponse],
)
def update_card_spending_limit(
    card_id: int,
    spending_limit_rule_id: int,
    payload: SpendingLimitRuleUpdate,
    owner_user_id: int = Depends(require_owns_card),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> ApiResponse[SpendingLimitRuleResponse]:
    try:
        rule = service.update_for_card(
            card_id=card_id,
            guardian_user_id=owner_user_id,
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
    "/cards/{card_id}/spending-limits/{spending_limit_rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_card_spending_limit(
    card_id: int,
    spending_limit_rule_id: int,
    _owner_user_id: int = Depends(require_owns_card),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> None:
    try:
        service.delete_for_card(card_id=card_id, spending_limit_rule_id=spending_limit_rule_id)
    except SpendingLimitRuleNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _RULE_NOT_FOUND)


# ─── Per-member cap on the shared card ──────────────────────────────────────


@router.get(
    "/cards/{card_id}/members/{dependent_user_id}/spending-limits",
    response_model=ApiResponse[list[SpendingLimitRuleResponse]],
    summary="(Guardian) List one member's own spending limits on the shared card.",
)
def list_card_member_spending_limits(
    card_id: int,
    dependent_user_id: int,
    _owner_user_id: int = Depends(require_owns_card),
    db: Session = Depends(get_db),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> ApiResponse[list[SpendingLimitRuleResponse]]:
    _require_card_member(db, card_id=card_id, dependent_user_id=dependent_user_id)
    rules = service.list_for_card_member(card_id, dependent_user_id)
    return ApiResponse[list[SpendingLimitRuleResponse]](
        success=True,
        message="Spending limits retrieved.",
        data=[SpendingLimitRuleResponse.model_validate(r) for r in rules],
    )


@router.post(
    "/cards/{card_id}/members/{dependent_user_id}/spending-limits",
    response_model=ApiResponse[SpendingLimitRuleResponse],
    status_code=status.HTTP_201_CREATED,
    summary="(Guardian) Set one member's own spending limit on the shared card.",
)
def create_card_member_spending_limit(
    card_id: int,
    dependent_user_id: int,
    payload: SpendingLimitRuleCreate,
    owner_user_id: int = Depends(require_owns_card),
    db: Session = Depends(get_db),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> ApiResponse[SpendingLimitRuleResponse]:
    _require_card_member(db, card_id=card_id, dependent_user_id=dependent_user_id)
    rule = service.create_for_card_member(
        card_id=card_id,
        dependent_user_id=dependent_user_id,
        guardian_user_id=owner_user_id,
        payload=payload,
    )
    return ApiResponse[SpendingLimitRuleResponse](
        success=True,
        message="Spending limit created.",
        data=SpendingLimitRuleResponse.model_validate(rule),
    )


@router.patch(
    "/cards/{card_id}/members/{dependent_user_id}/spending-limits/{spending_limit_rule_id}",
    response_model=ApiResponse[SpendingLimitRuleResponse],
)
def update_card_member_spending_limit(
    card_id: int,
    dependent_user_id: int,
    spending_limit_rule_id: int,
    payload: SpendingLimitRuleUpdate,
    owner_user_id: int = Depends(require_owns_card),
    db: Session = Depends(get_db),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> ApiResponse[SpendingLimitRuleResponse]:
    _require_card_member(db, card_id=card_id, dependent_user_id=dependent_user_id)
    try:
        rule = service.update_for_card_member(
            card_id=card_id,
            dependent_user_id=dependent_user_id,
            guardian_user_id=owner_user_id,
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
    "/cards/{card_id}/members/{dependent_user_id}/spending-limits/{spending_limit_rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_card_member_spending_limit(
    card_id: int,
    dependent_user_id: int,
    spending_limit_rule_id: int,
    _owner_user_id: int = Depends(require_owns_card),
    db: Session = Depends(get_db),
    service: SpendingLimitRuleService = Depends(get_spending_limit_rule_service),
) -> None:
    _require_card_member(db, card_id=card_id, dependent_user_id=dependent_user_id)
    try:
        service.delete_for_card_member(
            card_id=card_id,
            dependent_user_id=dependent_user_id,
            spending_limit_rule_id=spending_limit_rule_id,
        )
    except SpendingLimitRuleNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _RULE_NOT_FOUND)
