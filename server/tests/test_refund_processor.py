"""Unit tests for the refund auto-approval rules and batch processor.

`evaluate_refund` is a pure function: age-staleness beats the amount check
(a stale-but-small refund is auto-declined, not auto-approved). `process_batch`
dispatches through the same `RequestService.approve_refund`/`decline_refund`
paths already guarded against double-processing in
`test_refund_approval_guard.py`, so these tests focus on rule selection and
batch orchestration (counts, min-delay skip, error handling) rather than
re-proving the locking guard.
"""

import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from services.request.refund_processor import (  # noqa: E402
    RefundProcessorService,
    evaluate_refund,
)

_NOW = datetime(2026, 1, 15, tzinfo=timezone.utc)


def _rule(*, enabled=True, auto_approve_max_amount="25.00", max_age_days=7):
    return SimpleNamespace(
        enabled=enabled,
        auto_approve_max_amount=Decimal(auto_approve_max_amount),
        max_age_days=max_age_days,
    )


def _request(*, request_id=1, amount="10.00", created_at=None, recipient_card_id=1):
    tx = SimpleNamespace(
        amount=Decimal(amount), recipient_card_id=recipient_card_id, transaction_id=100 + request_id
    )
    detail = SimpleNamespace(transaction=tx, transaction_id=tx.transaction_id)
    return SimpleNamespace(request_id=request_id, created_at=created_at or _NOW, refund_detail=detail)


# ── evaluate_refund ──────────────────────────────────────────────────────────


def test_auto_approves_small_recent_refund():
    decision = evaluate_refund(_request(amount="10.00"), _rule(), now=_NOW)
    assert decision == "auto_approve"


def test_amount_exactly_at_threshold_auto_approves():
    decision = evaluate_refund(_request(amount="25.00"), _rule(auto_approve_max_amount="25.00"), now=_NOW)
    assert decision == "auto_approve"


def test_leaves_large_refund_for_manual_review():
    decision = evaluate_refund(_request(amount="1000.00"), _rule(auto_approve_max_amount="25.00"), now=_NOW)
    assert decision == "manual"


def test_auto_declines_stale_pending_refund_even_if_small():
    stale = _NOW - timedelta(days=8)
    decision = evaluate_refund(_request(amount="1.00", created_at=stale), _rule(max_age_days=7), now=_NOW)
    assert decision == "auto_decline"


def test_age_exactly_at_limit_does_not_auto_decline():
    at_limit = _NOW - timedelta(days=7)
    decision = evaluate_refund(_request(amount="10.00", created_at=at_limit), _rule(max_age_days=7), now=_NOW)
    assert decision == "auto_approve"


# ── process_batch ────────────────────────────────────────────────────────────


class _FakeRuleRepo:
    def __init__(self, rule):
        self._rule = rule

    def get(self):
        return self._rule


class _FakeRequestRepo:
    """Minimal repo double honouring the same pending-lock contract as
    test_refund_approval_guard.py's FakeRepo, extended with the
    list_pending_refunds the batch processor pulls candidates from.
    """

    def __init__(self, requests, *, card_balance=Decimal("10") ** 9):
        self._by_id = {r.request_id: r for r in requests}
        self._pending_ids = set(self._by_id)
        self._tx_by_id = {r.refund_detail.transaction_id: r.refund_detail.transaction for r in requests}
        self._card_balance = card_balance
        self._db = object()
        self.approve_calls = 0
        self.decline_calls = 0

    def list_pending_refunds(self, *, limit=100):
        return [self._by_id[i] for i in sorted(self._by_id) if i in self._pending_ids][:limit]

    def get_by_id(self, request_id):
        return self._by_id.get(request_id)

    def status_name_for(self, status_id):
        return "pending"

    def lock_pending_request(self, request_id):
        if request_id not in self._pending_ids:
            return None
        return self._by_id[request_id]

    def get_transaction_by_id(self, transaction_id):
        return self._tx_by_id[transaction_id]

    def get_card_for_update(self, card_id):
        return SimpleNamespace(balance=self._card_balance)

    def approve_refund(self, request):
        self.approve_calls += 1
        self._pending_ids.discard(request.request_id)
        return request

    def decline_refund(self, request):
        self.decline_calls += 1
        self._pending_ids.discard(request.request_id)
        return request


def _settings(*, refund_min_processing_delay_seconds=3):
    return SimpleNamespace(refund_min_processing_delay_seconds=refund_min_processing_delay_seconds)


def _process(repo, rule, *, settings=None, now=_NOW):
    service = RefundProcessorService(repo, settings=settings or _settings(), rule_repo=_FakeRuleRepo(rule))
    with patch("services.email.transaction_notifier.TransactionEmailNotifier"), patch(
        "services.request.refund_processor.datetime"
    ) as mock_datetime:
        mock_datetime.now.return_value = now
        return service.process_batch()


def test_disabled_rules_are_a_no_op():
    repo = _FakeRequestRepo([_request(amount="1.00")])
    stats = _process(repo, _rule(enabled=False))
    assert stats == {
        "refund_processed": 0,
        "refund_auto_approved": 0,
        "refund_auto_declined": 0,
        "refund_left_manual": 0,
        "refund_errors": 0,
    }
    assert repo.approve_calls == 0
    assert repo.decline_calls == 0


def test_mixed_batch_dispatches_correctly():
    old_enough = _NOW - timedelta(seconds=10)
    stale = _NOW - timedelta(days=8)
    requests = [
        _request(request_id=1, amount="10.00", created_at=old_enough),  # auto-approve
        _request(request_id=2, amount="1.00", created_at=stale),  # auto-decline (stale)
        _request(request_id=3, amount="1000.00", created_at=old_enough),  # manual
    ]
    repo = _FakeRequestRepo(requests)
    stats = _process(repo, _rule(auto_approve_max_amount="25.00", max_age_days=7))

    assert stats["refund_processed"] == 3
    assert stats["refund_auto_approved"] == 1
    assert stats["refund_auto_declined"] == 1
    assert stats["refund_left_manual"] == 1
    assert stats["refund_errors"] == 0
    assert repo.approve_calls == 1
    assert repo.decline_calls == 1


def test_requests_younger_than_min_delay_are_skipped():
    fresh = _NOW - timedelta(seconds=1)
    repo = _FakeRequestRepo([_request(amount="1.00", created_at=fresh)])
    stats = _process(repo, _rule(), settings=_settings(refund_min_processing_delay_seconds=30))

    assert stats["refund_processed"] == 0
    assert repo.approve_calls == 0


def test_insufficient_balance_is_caught_and_counted_as_error():
    old_enough = _NOW - timedelta(seconds=10)
    requests = [
        _request(request_id=1, amount="10.00", created_at=old_enough),
        _request(request_id=2, amount="5.00", created_at=old_enough),
    ]
    repo = _FakeRequestRepo(requests, card_balance=Decimal("0"))
    stats = _process(repo, _rule(auto_approve_max_amount="25.00"))

    assert stats["refund_processed"] == 2
    assert stats["refund_errors"] == 2
    assert stats["refund_auto_approved"] == 0
    assert repo.approve_calls == 0
