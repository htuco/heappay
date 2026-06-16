"""Service-level tests for the user-initiated cancel path.

Cancelling a pending outgoing transaction must read as a distinct ``cancelled``
status (reason ``USER_CANCELLED``), not as a processor-driven ``failed`` — while
still releasing the sender's held funds. These tests exercise the real
``TransactionService._apply_status_change`` routing over a fake repo.
"""

import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from repositories.transaction.transaction import TransactionStateError  # noqa: E402
from schemas.transaction import TransactionPatch  # noqa: E402
from services.transaction.transaction import TransactionService  # noqa: E402

_STATUS_IDS = {"pending": 1, "completed": 2, "failed": 3, "reversed": 4, "cancelled": 5}


class _Tx:
    def __init__(self, status_id: int = 1):
        self.transaction_id = 1
        self.sender_card_id = 10
        self.recipient_card_id = 20
        self.amount = Decimal("30.00")
        self.status_id = status_id
        # Eligible immediately so the processing-delay guard passes.
        self.processing_eligible_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        self.processed_at = None
        self.processed_by = None
        self.deny_reason_code = None


class _FakeRepo:
    """Records which terminal repo method ran so we can assert the routing."""

    def __init__(self):
        self._tx = _Tx()
        self.cancel_calls = 0
        self.fail_calls = 0

    def get_status_id_by_name(self, name: str):
        return _STATUS_IDS.get(name)

    def transaction_status_exists(self, status_id: int) -> bool:
        return status_id in _STATUS_IDS.values()

    def get_by_id(self, transaction_id: int):
        return self._tx if transaction_id == self._tx.transaction_id else None

    def card_owner_id(self, card_id: int):
        # Sender card 10 belongs to user 1; recipient card 20 to user 2.
        return {10: 1, 20: 2}.get(card_id)

    def cancel(self, transaction_id: int, *, reason_code: str, processed_by: str):
        self.cancel_calls += 1
        self._tx.status_id = _STATUS_IDS["cancelled"]
        self._tx.deny_reason_code = reason_code
        self._tx.processed_by = processed_by
        return self._tx

    def fail(self, transaction_id: int, *, reason_code: str, processed_by: str):
        self.fail_calls += 1
        self._tx.status_id = _STATUS_IDS["failed"]
        self._tx.deny_reason_code = reason_code
        self._tx.processed_by = processed_by
        return self._tx

    def update(self, row, changes):
        for key, value in changes.items():
            setattr(row, key, value)
        return row


def test_user_patch_to_cancelled_routes_through_cancel():
    repo = _FakeRepo()
    service = TransactionService(repo)
    row = service.patch(
        1, TransactionPatch(status_id=_STATUS_IDS["cancelled"]), user_id=1
    )
    assert repo.cancel_calls == 1
    assert repo.fail_calls == 0
    assert row.status_id == _STATUS_IDS["cancelled"]
    assert row.deny_reason_code == "USER_CANCELLED"


def test_staff_cancel_uses_staff_reason():
    repo = _FakeRepo()
    service = TransactionService(repo)
    row = service.patch_as_staff(1, TransactionPatch(status_id=_STATUS_IDS["cancelled"]))
    assert repo.cancel_calls == 1
    assert row.deny_reason_code == "STAFF_CANCELLED"


def test_patch_to_failed_still_routes_through_fail():
    repo = _FakeRepo()
    service = TransactionService(repo)
    row = service.patch(1, TransactionPatch(status_id=_STATUS_IDS["failed"]), user_id=1)
    assert repo.fail_calls == 1
    assert repo.cancel_calls == 0
    assert row.status_id == _STATUS_IDS["failed"]
    assert row.deny_reason_code == "USER_DENIED"
