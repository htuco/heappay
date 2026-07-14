from datetime import datetime, timedelta, timezone
from typing import Literal

from models.refund_approval_rule import RefundApprovalRule
from models.request import Request
from repositories.refund_approval.refund_approval_rule import RefundApprovalRuleRepository
from repositories.request.request import RequestRepository
from services.request.request import (
    RequestNotFoundError,
    RequestNotPendingError,
    RequestService,
)
from settings import Settings, get_settings

Decision = Literal["auto_decline", "manual"]


def evaluate_refund(request: Request, rule: RefundApprovalRule, *, now: datetime) -> Decision:
    """Pure rule evaluation — no balance or status changes.

    A refund that has sat pending longer than `max_age_days` is auto-declined
    — staff had the whole review window. Everything else is left for manual
    review: reversing money out of another user's wallet always requires a
    human decision, so there is no auto-approve path here.
    """
    created = request.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if now - created > timedelta(days=rule.max_age_days):
        return "auto_decline"
    return "manual"


class RefundProcessorService:
    def __init__(
        self,
        repo: RequestRepository,
        settings: Settings | None = None,
        rule_repo: RefundApprovalRuleRepository | None = None,
    ) -> None:
        self._repo = repo
        self._settings = settings or get_settings()
        self._rule_repo = rule_repo or RefundApprovalRuleRepository(repo._db)
        self._request_service = RequestService(repo)

    def process_batch(self, *, limit: int = 100) -> dict[str, int]:
        stats = {
            "refund_processed": 0,
            "refund_auto_declined": 0,
            "refund_left_manual": 0,
            "refund_errors": 0,
        }
        rule = self._rule_repo.get()
        if not rule.enabled:
            return stats

        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=self._settings.refund_min_processing_delay_seconds)

        for request in self._repo.list_pending_refunds(limit=limit):
            created = request.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created > cutoff:
                continue  # too fresh — give the requester/staff a beat first

            decision = evaluate_refund(request, rule, now=now)
            stats["refund_processed"] += 1
            try:
                if decision == "auto_decline":
                    self._request_service.decline_refund(request_id=request.request_id)
                    stats["refund_auto_declined"] += 1
                else:
                    stats["refund_left_manual"] += 1
            except (RequestNotFoundError, RequestNotPendingError):
                stats["refund_errors"] += 1
        return stats
