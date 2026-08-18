"""Guard tests for the peer-to-peer money-request flow.

A pending money request must only be paid or declined once. Pay settles through
TransactionService.create (no hand-rolled balance math); the pending-row lock
is what stops a double-click from creating two payments.
"""

from decimal import Decimal
import os

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from services.request.request import (  # noqa: E402
    ForbiddenError,
    MoneyRequestAlreadyPendingError,
    RequestNotFoundError,
    RequestNotPendingError,
    RequestService,
    RequesterNoCardError,
    SelfRequestError,
    TargetNotFoundError,
)
from services.transaction.transaction import (  # noqa: E402
    InsufficientBalanceError,
)

_PENDING, _APPROVED, _DECLINED = 1, 2, 3
_STATUS_NAMES = {_PENDING: "pending", _APPROVED: "approved", _DECLINED: "declined"}


class _MoneyDetail:
    def __init__(self, amount: Decimal) -> None:
        self.amount = amount
        self.settled_transaction_id = None


class _RequestRow:
    def __init__(
        self,
        request_id: int,
        status_id: int,
        *,
        requester_user_id: int = 10,
        target_user_id: int = 20,
    ) -> None:
        self.request_id = request_id
        self.request_status_id = status_id
        self.requester_user_id = requester_user_id
        self.target_user_id = target_user_id
        self.note = "lunch"
        self.money_request_detail = _MoneyDetail(Decimal("12.50"))


class _Tx:
    transaction_id = 500


class FakeTxService:
    def __init__(self, error: Exception | None = None) -> None:
        self.create_calls = 0
        self.last_payload = None
        self.last_user_id = None
        self.error = error

    def create(self, payload, *, user_id):
        self.create_calls += 1
        self.last_payload = payload
        self.last_user_id = user_id
        if self.error is not None:
            raise self.error
        return _Tx(), True


class FakeRepo:
    def __init__(
        self,
        status_id: int,
        *,
        target_exists: bool = True,
        pending_between: bool = False,
        requester_card_id: int | None = 77,
    ) -> None:
        self._row = _RequestRow(1, status_id)
        self._target_exists = target_exists
        self._pending_between = pending_between
        self._requester_card_id = requester_card_id
        self.create_calls = 0
        self.approve_calls = 0
        self.decline_calls = 0
        self.last_settled_tx_id = None

    def get_by_id(self, request_id: int):
        return self._row if request_id == self._row.request_id else None

    def status_name_for(self, status_id: int):
        return _STATUS_NAMES.get(status_id)

    def lock_pending_request(self, request_id: int):
        if self._row.request_id != request_id:
            return None
        if self._row.request_status_id != _PENDING:
            return None
        return self._row

    def user_exists(self, user_id: int) -> bool:
        return self._target_exists

    def get_pending_money_request_between(self, requester_user_id, target_user_id):
        return self._row if self._pending_between else None

    def create_money_request(self, **kwargs):
        self.create_calls += 1
        return self._row

    def default_active_card_id_for_user(self, user_id: int):
        return self._requester_card_id

    def get_payment_type_id(self) -> int:
        return 1

    def mark_money_request_approved(self, request, *, settled_transaction_id):
        self.approve_calls += 1
        self.last_settled_tx_id = settled_transaction_id
        request.request_status_id = _APPROVED
        request.money_request_detail.settled_transaction_id = settled_transaction_id
        return request

    def decline_money_request(self, request):
        self.decline_calls += 1
        request.request_status_id = _DECLINED
        return request


def test_request_money_succeeds() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    result = service.request_money(
        requester_user_id=10,
        target_user_id=20,
        amount=Decimal("12.50"),
        note="lunch",
    )
    assert repo.create_calls == 1
    assert result.request_id == 1


def test_self_request_is_rejected() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    with pytest.raises(SelfRequestError):
        service.request_money(
            requester_user_id=10, target_user_id=10, amount=Decimal("5"), note=None
        )
    assert repo.create_calls == 0


def test_missing_target_is_rejected() -> None:
    repo = FakeRepo(_PENDING, target_exists=False)
    service = RequestService(repo)
    with pytest.raises(TargetNotFoundError):
        service.request_money(
            requester_user_id=10, target_user_id=99, amount=Decimal("5"), note=None
        )
    assert repo.create_calls == 0


def test_duplicate_pending_request_is_rejected() -> None:
    repo = FakeRepo(_PENDING, pending_between=True)
    service = RequestService(repo)
    with pytest.raises(MoneyRequestAlreadyPendingError):
        service.request_money(
            requester_user_id=10, target_user_id=20, amount=Decimal("5"), note=None
        )
    assert repo.create_calls == 0


def test_pay_pending_money_request_succeeds() -> None:
    repo = FakeRepo(_PENDING)
    tx = FakeTxService()
    service = RequestService(repo, transaction_service=tx)
    result = service.pay_money_request(
        request_id=1, payer_user_id=20, sender_card_id=3
    )
    assert tx.create_calls == 1
    assert tx.last_user_id == 20
    assert tx.last_payload.sender_card_id == 3
    assert tx.last_payload.recipient_card_id == 77
    assert tx.last_payload.amount == Decimal("12.50")
    assert tx.last_payload.idempotency_key == "moneyreq:1"
    assert repo.approve_calls == 1
    assert repo.last_settled_tx_id == 500
    assert result.request_status_id == _APPROVED


def test_pay_by_non_target_is_forbidden() -> None:
    repo = FakeRepo(_PENDING)
    tx = FakeTxService()
    service = RequestService(repo, transaction_service=tx)
    with pytest.raises(ForbiddenError):
        service.pay_money_request(request_id=1, payer_user_id=10, sender_card_id=3)
    assert tx.create_calls == 0
    assert repo.approve_calls == 0


def test_double_pay_is_blocked() -> None:
    repo = FakeRepo(_PENDING)
    tx = FakeTxService()
    service = RequestService(repo, transaction_service=tx)
    service.pay_money_request(request_id=1, payer_user_id=20, sender_card_id=3)
    with pytest.raises(RequestNotPendingError):
        service.pay_money_request(request_id=1, payer_user_id=20, sender_card_id=3)
    assert tx.create_calls == 1
    assert repo.approve_calls == 1


def test_pay_already_declined_is_blocked() -> None:
    repo = FakeRepo(_DECLINED)
    tx = FakeTxService()
    service = RequestService(repo, transaction_service=tx)
    with pytest.raises(RequestNotPendingError):
        service.pay_money_request(request_id=1, payer_user_id=20, sender_card_id=3)
    assert tx.create_calls == 0
    assert repo.approve_calls == 0


def test_pay_missing_request_raises_not_found() -> None:
    repo = FakeRepo(_PENDING)
    tx = FakeTxService()
    service = RequestService(repo, transaction_service=tx)
    with pytest.raises(RequestNotFoundError):
        service.pay_money_request(request_id=999, payer_user_id=20, sender_card_id=3)


def test_pay_requester_without_card_is_conflict() -> None:
    repo = FakeRepo(_PENDING, requester_card_id=None)
    tx = FakeTxService()
    service = RequestService(repo, transaction_service=tx)
    with pytest.raises(RequesterNoCardError):
        service.pay_money_request(request_id=1, payer_user_id=20, sender_card_id=3)
    assert tx.create_calls == 0
    assert repo.approve_calls == 0


def test_insufficient_funds_leaves_request_pending() -> None:
    repo = FakeRepo(_PENDING)
    tx = FakeTxService(error=InsufficientBalanceError())
    service = RequestService(repo, transaction_service=tx)
    with pytest.raises(InsufficientBalanceError):
        service.pay_money_request(request_id=1, payer_user_id=20, sender_card_id=3)
    assert tx.create_calls == 1
    assert repo.approve_calls == 0
    assert repo._row.request_status_id == _PENDING


def test_decline_pending_money_request_succeeds() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    service.decline_money_request(request_id=1, actor_user_id=20)
    assert repo.decline_calls == 1


def test_decline_by_non_target_is_forbidden() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    with pytest.raises(ForbiddenError):
        service.decline_money_request(request_id=1, actor_user_id=10)
    assert repo.decline_calls == 0


def test_double_decline_is_blocked() -> None:
    repo = FakeRepo(_PENDING)
    service = RequestService(repo)
    service.decline_money_request(request_id=1, actor_user_id=20)
    with pytest.raises(RequestNotPendingError):
        service.decline_money_request(request_id=1, actor_user_id=20)
    assert repo.decline_calls == 1
