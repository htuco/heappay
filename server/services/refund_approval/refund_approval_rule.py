from models.refund_approval_rule import RefundApprovalRule
from repositories.refund_approval.refund_approval_rule import RefundApprovalRuleRepository


class RefundApprovalRuleService:
    def __init__(self, repo: RefundApprovalRuleRepository) -> None:
        self._repo = repo

    def get(self) -> RefundApprovalRule:
        return self._repo.get()

    def update(
        self,
        *,
        enabled: bool,
        max_age_days: int,
        updated_by_user_id: int,
    ) -> RefundApprovalRule:
        return self._repo.update(
            enabled=enabled,
            max_age_days=max_age_days,
            updated_by_user_id=updated_by_user_id,
        )
