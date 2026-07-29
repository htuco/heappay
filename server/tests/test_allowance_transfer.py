"""Allowance transfer tests: AllowanceService against a fake UserRepository,
mirroring test_category_rules.py's fake-repo unit-test style -- this is
testing orchestration/validation, not the underlying row-locked SQL (that's
UserRepository.transfer_wallet_balance, exercised separately).
"""
from decimal import Decimal

import pytest

from services.family.allowance import (
    AllowanceInsufficientFundsError,
    AllowanceInvalidAmountError,
    AllowanceService,
    AllowanceUserNotFoundError,
)


class FakeUserRepo:
    def __init__(self, balances):
        self._balances = dict(balances)
        self.calls = []
        # AllowanceService._notify builds a FamilyNotificationService from this.
        # None is fine: the notifier is fail-open, so with no real session it
        # logs and returns rather than raising into the transfer.
        self._db = None

    def transfer_wallet_balance(self, *, from_user_id, to_user_id, amount):
        self.calls.append((from_user_id, to_user_id, amount))
        if from_user_id not in self._balances or to_user_id not in self._balances:
            raise ValueError("User not found for wallet transfer.")
        if self._balances[from_user_id] < amount:
            raise ValueError("Insufficient wallet balance.")
        self._balances[from_user_id] -= amount
        self._balances[to_user_id] += amount

        class _User:
            def __init__(self, balance):
                self.wallet_balance = balance

        return _User(self._balances[from_user_id]), _User(self._balances[to_user_id])


def test_transfer_moves_balance_both_ways() -> None:
    repo = FakeUserRepo({1: Decimal("100.00"), 2: Decimal("0.00")})
    svc = AllowanceService(repo)
    guardian_balance, dependent_balance = svc.transfer(
        guardian_user_id=1, dependent_user_id=2, amount=Decimal("30.00")
    )
    assert guardian_balance == Decimal("70.00")
    assert dependent_balance == Decimal("30.00")
    assert repo.calls == [(1, 2, Decimal("30.00"))]


def test_zero_amount_is_invalid() -> None:
    repo = FakeUserRepo({1: Decimal("100.00"), 2: Decimal("0.00")})
    svc = AllowanceService(repo)
    with pytest.raises(AllowanceInvalidAmountError):
        svc.transfer(guardian_user_id=1, dependent_user_id=2, amount=Decimal("0"))
    assert repo.calls == []


def test_negative_amount_is_invalid() -> None:
    repo = FakeUserRepo({1: Decimal("100.00"), 2: Decimal("0.00")})
    svc = AllowanceService(repo)
    with pytest.raises(AllowanceInvalidAmountError):
        svc.transfer(guardian_user_id=1, dependent_user_id=2, amount=Decimal("-5.00"))


def test_insufficient_funds_raises() -> None:
    repo = FakeUserRepo({1: Decimal("10.00"), 2: Decimal("0.00")})
    svc = AllowanceService(repo)
    with pytest.raises(AllowanceInsufficientFundsError):
        svc.transfer(guardian_user_id=1, dependent_user_id=2, amount=Decimal("30.00"))


def test_missing_user_raises_not_found() -> None:
    repo = FakeUserRepo({1: Decimal("100.00")})
    svc = AllowanceService(repo)
    with pytest.raises(AllowanceUserNotFoundError):
        svc.transfer(guardian_user_id=1, dependent_user_id=999, amount=Decimal("10.00"))
