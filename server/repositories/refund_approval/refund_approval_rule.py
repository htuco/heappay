from sqlalchemy import select
from sqlalchemy.orm import Session

from models.refund_approval_rule import RefundApprovalRule


class RefundApprovalRuleRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get(self) -> RefundApprovalRule:
        """Return the singleton rule row, seeded by migration d5c5b9e2b4b1."""
        row = self._db.scalars(select(RefundApprovalRule).limit(1)).first()
        if row is None:
            # id is pinned to 1 rather than left to the sequence. The table
            # carries ck_refund_approval_policy_singleton (id = 1), so once the
            # seeded row has been inserted the sequence sits at 1 and the next
            # nextval() would yield 2 -- making this recovery path fail the
            # constraint instead of healing the missing row.
            row = RefundApprovalRule(id=1, enabled=False, max_age_days=7)
            self._db.add(row)
            self._db.commit()
            self._db.refresh(row)
        return row

    def update(
        self,
        *,
        enabled: bool,
        max_age_days: int,
        updated_by_user_id: int,
    ) -> RefundApprovalRule:
        row = self.get()
        row.enabled = enabled
        row.max_age_days = max_age_days
        row.updated_by_user_id = updated_by_user_id
        self._db.commit()
        self._db.refresh(row)
        return row
