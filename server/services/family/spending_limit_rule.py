import uuid

from models.spending_limit_rule import SpendingLimitRule
from repositories.family.spending_limit_rule import SpendingLimitRuleRepository
from schemas.spending_limit_rule import SpendingLimitRuleCreate, SpendingLimitRuleUpdate


class SpendingLimitRuleError(Exception):
    """A spending-limit-rule operation could not be completed."""


class SpendingLimitRuleNotFoundError(SpendingLimitRuleError):
    """The rule does not exist for this scope."""


class SpendingLimitRuleService:
    def __init__(self, repo: SpendingLimitRuleRepository) -> None:
        self._repo = repo

    def list_for_dependent(self, dependent_user_id: int) -> list[SpendingLimitRule]:
        return self._repo.list_for_dependent(dependent_user_id)

    def create(
        self, *, dependent_user_id: int, guardian_user_id: int, payload: SpendingLimitRuleCreate
    ) -> SpendingLimitRule:
        row = SpendingLimitRule(
            dependent_user_id=dependent_user_id,
            category_id=payload.category_id,
            period=payload.period,
            max_amount=payload.max_amount,
            requires_approval_above=payload.requires_approval_above,
            requires_approval_always=payload.requires_approval_always,
            enabled=payload.enabled,
            updated_by_user_id=guardian_user_id,
        )
        created = self._repo.create(row)
        self._notify(dependent_user_id=dependent_user_id, guardian_user_id=guardian_user_id)
        return created

    def update(
        self,
        *,
        dependent_user_id: int,
        guardian_user_id: int,
        spending_limit_rule_id: int,
        payload: SpendingLimitRuleUpdate,
    ) -> SpendingLimitRule:
        row = self._repo.get_for_dependent(dependent_user_id, spending_limit_rule_id)
        if row is None:
            raise SpendingLimitRuleNotFoundError("Spending limit rule not found.")

        changes = payload.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(row, field, value)
        row.updated_by_user_id = guardian_user_id
        saved = self._repo.save(row)
        self._notify(dependent_user_id=dependent_user_id, guardian_user_id=guardian_user_id)
        return saved

    def delete(self, *, dependent_user_id: int, spending_limit_rule_id: int) -> None:
        row = self._repo.get_for_dependent(dependent_user_id, spending_limit_rule_id)
        if row is None:
            raise SpendingLimitRuleNotFoundError("Spending limit rule not found.")
        self._repo.delete(row)

    # ── Shared-card scoped rules ────────────────────────────────────────────
    # Same model, two different scopes: card_id set + dependent_user_id NULL
    # is the guardian's overall cap on the card; both set is one member's own
    # cap on it. No dependent-spend notification for the overall case -- there
    # isn't a single dependent to notify.

    def list_for_card(self, card_id: int) -> list[SpendingLimitRule]:
        return self._repo.list_for_card(card_id)

    def create_for_card(
        self, *, card_id: int, guardian_user_id: int, payload: SpendingLimitRuleCreate
    ) -> SpendingLimitRule:
        row = SpendingLimitRule(
            card_id=card_id,
            dependent_user_id=None,
            category_id=payload.category_id,
            period=payload.period,
            max_amount=payload.max_amount,
            requires_approval_above=payload.requires_approval_above,
            requires_approval_always=payload.requires_approval_always,
            enabled=payload.enabled,
            updated_by_user_id=guardian_user_id,
        )
        return self._repo.create(row)

    def update_for_card(
        self,
        *,
        card_id: int,
        guardian_user_id: int,
        spending_limit_rule_id: int,
        payload: SpendingLimitRuleUpdate,
    ) -> SpendingLimitRule:
        row = self._repo.get_for_card(card_id, spending_limit_rule_id)
        if row is None:
            raise SpendingLimitRuleNotFoundError("Spending limit rule not found.")
        changes = payload.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(row, field, value)
        row.updated_by_user_id = guardian_user_id
        return self._repo.save(row)

    def delete_for_card(self, *, card_id: int, spending_limit_rule_id: int) -> None:
        row = self._repo.get_for_card(card_id, spending_limit_rule_id)
        if row is None:
            raise SpendingLimitRuleNotFoundError("Spending limit rule not found.")
        self._repo.delete(row)

    def list_for_card_member(self, card_id: int, dependent_user_id: int) -> list[SpendingLimitRule]:
        return self._repo.list_for_card_member(card_id, dependent_user_id)

    def create_for_card_member(
        self,
        *,
        card_id: int,
        dependent_user_id: int,
        guardian_user_id: int,
        payload: SpendingLimitRuleCreate,
    ) -> SpendingLimitRule:
        row = SpendingLimitRule(
            card_id=card_id,
            dependent_user_id=dependent_user_id,
            category_id=payload.category_id,
            period=payload.period,
            max_amount=payload.max_amount,
            requires_approval_above=payload.requires_approval_above,
            requires_approval_always=payload.requires_approval_always,
            enabled=payload.enabled,
            updated_by_user_id=guardian_user_id,
        )
        created = self._repo.create(row)
        self._notify(dependent_user_id=dependent_user_id, guardian_user_id=guardian_user_id)
        return created

    def update_for_card_member(
        self,
        *,
        card_id: int,
        dependent_user_id: int,
        guardian_user_id: int,
        spending_limit_rule_id: int,
        payload: SpendingLimitRuleUpdate,
    ) -> SpendingLimitRule:
        row = self._repo.get_for_card_member(card_id, dependent_user_id, spending_limit_rule_id)
        if row is None:
            raise SpendingLimitRuleNotFoundError("Spending limit rule not found.")
        changes = payload.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(row, field, value)
        row.updated_by_user_id = guardian_user_id
        saved = self._repo.save(row)
        self._notify(dependent_user_id=dependent_user_id, guardian_user_id=guardian_user_id)
        return saved

    def delete_for_card_member(
        self, *, card_id: int, dependent_user_id: int, spending_limit_rule_id: int
    ) -> None:
        row = self._repo.get_for_card_member(card_id, dependent_user_id, spending_limit_rule_id)
        if row is None:
            raise SpendingLimitRuleNotFoundError("Spending limit rule not found.")
        self._repo.delete(row)

    def _notify(self, *, dependent_user_id: int, guardian_user_id: int) -> None:
        from services.family.family_notification import FamilyNotificationService

        FamilyNotificationService(self._repo._db).notify_spending_limit_changed(
            dependent_user_id=dependent_user_id,
            guardian_user_id=guardian_user_id,
            reference_id=str(uuid.uuid4()),
        )
