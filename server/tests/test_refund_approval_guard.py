"""Guard tests for the refund approve/decline flow.

A pending refund must only be approved or declined once. A double-click or two
staff acting at the same time used to reverse the balances twice; the service now
locks the request row and re-checks it is still pending before acting.
"""

import os

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from services.request.request import (  # noqa: E402
    RequestNotFoundError,
    RequestNotPendingError,
    RequestService,
)

_PENDING, _APPROVED, _DECLINED = 1, 2, 3
_STATUS_NAMES = {_PENDING: "pending", _APPROVED: "approved", _DECLINED: "declined"}


class _RefundDetail:
    def __init__(self, transaction_id: int) -> None:
        self.transaction_id = transaction_id


class _RequestRow:
    def __init__(self, request_id: int, status_id: int) -> None:
        self.request_id = request_id
        self.request_status_id = status_id
        self.note = None
        self.refund_detail = _RefundDetail(transaction_id=100 + request_id)


class FakeRepo:
    """Minimal repo double that honours the pending lock contract.

    `approve_calls` / `decline_calls` count how many times the balance-mutating
    repo methods actually ran, so a blocked second attempt is observable.
    """

    def __init__(self, status_id: int) -> None:
        self._row = _RequestRow(1, status_id)
        self.approve_calls = 0
        self.decline_calls = 0

    def get_by_id(self, request_id: int):
        return self._row if request_id == self._row.request_id else None

    def status_name_for(self, status_id: int):
        return _STATUS_NAMES.get(status_id)

    def lock_pending_request(self, request_id: int):
        if self._row.request_status_id != _PENDING:
            return None
        return self._row

    def get_transaction_by_id(self, transaction_id: int):
        class _Tx:
            amount = 1
            recipient_card_id = 1

        return _Tx()

    def get_card_for_update(self, card_id):
        class _Card:
            balance = 10**9

        return _Card()

    def approve_refund(self, request):
        self.approve_calls += 1
        request.request_status_id = _APPROVED
        return request

    def decline_refund(self, request):
        self.decline_calls += 1
        request.request_status_id = _DECLINED
        return request


def test_approve_pending_refund_succeeds() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    service.approve_refund(request_id=1)
    assert repo.approve_calls == 1


def test_double_approve_is_blocked() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    service.approve_refund(request_id=1)
    with pytest.raises(RequestNotPendingError):
        service.approve_refund(request_id=1)
    # the balance reversal ran exactly once, not twice
    assert repo.approve_calls == 1


def test_approve_already_declined_is_blocked() -> None:
    repo = FakeRepo(_DECLINED)
    service = RequestService(repo)
    with pytest.raises(RequestNotPendingError):
        service.approve_refund(request_id=1)
    assert repo.approve_calls == 0


def test_decline_pending_refund_succeeds() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    service.decline_refund(request_id=1)
    assert repo.decline_calls == 1


def test_double_decline_is_blocked() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    service.decline_refund(request_id=1)
    with pytest.raises(RequestNotPendingError):
        service.decline_refund(request_id=1)
    assert repo.decline_calls == 1


def test_decline_already_approved_is_blocked() -> None:
    repo = FakeRepo(_APPROVED)
    service = RequestService(repo)
    with pytest.raises(RequestNotPendingError):
        service.decline_refund(request_id=1)
    assert repo.decline_calls == 0


def test_approve_missing_request_raises_not_found() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    with pytest.raises(RequestNotFoundError):
        service.approve_refund(request_id=999)
