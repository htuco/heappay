"""Shared-family-card authorization tests for `TransactionService.create()`:
owner-sends (unchanged path), authorized-member-sends (new enforcement fires,
notification fires), and unauthorized-non-member-sends (still ForbiddenError).

Mirrors `test_transaction_frozen_card.py`'s hand-built `_FakeRepo` style --
just enough of `TransactionRepository` for `create()`, plus fakes for the
family-package repos `create()` now also depends on.
"""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from schemas.transaction import TransactionCreate
from services.transaction.transaction import (
    ForbiddenError,
    SpendingLimitExceededError,
    TransactionService,
)

_ACTIVE = 1

GUARDIAN_ID = 1
MEMBER_ID = 2
NON_MEMBER_ID = 3
RECIPIENT_ID = 9
CARD_ID = 100
RECIPIENT_CARD_ID = 200


class _Card:
    def __init__(self, card_id, *, user_id, balance="1000.00"):
        self.card_id = card_id
        self.user_id = user_id
        self.status_id = _ACTIVE
        self.balance = Decimal(balance)
        self.deleted_at = None
        self.expires_at = date(2030, 12, 31)
        self.is_main = True


class _FakeDb:
    def commit(self):
        pass


class _FakeRepo:
    def __init__(self, cards):
        self._cards = cards
        self._db = _FakeDb()
        self.created = False
        self.last_kwargs = None

    def get_by_idempotency_key(self, key):
        return None

    def find_recent_duplicate(self, **_kwargs):
        return None

    def transaction_type_exists(self, type_id):
        return True

    def transaction_category_exists(self, category_id):
        return True

    def get_transaction_type_name(self, type_id):
        return "payment"

    def get_status_id_by_name(self, name):
        return {"pending": 10}.get(name)

    def get_card_status_id_by_name(self, name):
        return {"active": _ACTIVE, "frozen": 3}.get(name)

    def get_card_for_update(self, card_id):
        return self._cards.get(card_id)

    def create_with_balance_update(self, **kwargs):
        self.created = True
        self.last_kwargs = kwargs

        class _Tx:
            transaction_id = 1

        return _Tx()


class _FakeFamilyLinkRepo:
    def get_accepted_for_dependent(self, dependent_user_id):
        return None


class _FakeFamilyCardMemberRepo:
    def __init__(self, members):
        self._members = members

    def is_member(self, *, card_id, dependent_user_id):
        return (card_id, dependent_user_id) in self._members


class _FakeSpendingLimitRuleRepo:
    def __init__(self, rules=()):
        self._rules = list(rules)

    def list_applicable(self, *, dependent_user_id, category_id, card_id=None):
        return self._rules

    def sum_period_spend(self, *, dependent_user_id, category_id, period, now, card_id=None):
        return Decimal("0")


def _service(cards, *, members=(), notify_calls=None):
    repo = _FakeRepo(cards)
    svc = TransactionService(
        repo,
        approval_repo=_NullApprovalRepo(),
        auth_repo=None,
        family_link_repo=_FakeFamilyLinkRepo(),
        spending_limit_rule_repo=_FakeSpendingLimitRuleRepo(),
        family_card_member_repo=_FakeFamilyCardMemberRepo(set(members)),
    )
    if notify_calls is not None:
        svc._notify_shared_card_spend = lambda **kwargs: notify_calls.append(kwargs)
    return svc


class _NullApprovalRepo:
    def record_event(self, **_kwargs):
        pass


def _payload(sender_id, recipient_id, amount="10.00"):
    return TransactionCreate(
        sender_card_id=sender_id,
        recipient_card_id=recipient_id,
        transaction_type_id=1,
        amount=Decimal(amount),
        note=None,
        idempotency_key=None,
    )


def _cards():
    return {
        CARD_ID: _Card(CARD_ID, user_id=GUARDIAN_ID),
        RECIPIENT_CARD_ID: _Card(RECIPIENT_CARD_ID, user_id=RECIPIENT_ID),
    }


def test_owner_sends_from_own_card_unaffected() -> None:
    svc = _service(_cards())
    row, created = svc.create(_payload(CARD_ID, RECIPIENT_CARD_ID), user_id=GUARDIAN_ID)
    assert created is True
    assert svc._repo.last_kwargs["initiated_by_user_id"] == GUARDIAN_ID
    assert svc._repo.last_kwargs["approver_user_id"] == GUARDIAN_ID


def test_authorized_member_can_spend_from_shared_card() -> None:
    notify_calls = []
    svc = _service(_cards(), members={(CARD_ID, MEMBER_ID)}, notify_calls=notify_calls)
    row, created = svc.create(_payload(CARD_ID, RECIPIENT_CARD_ID), user_id=MEMBER_ID)
    assert created is True
    assert svc._repo.last_kwargs["initiated_by_user_id"] == MEMBER_ID
    # No spending-limit rule requires approval in this fixture, so the
    # approver stays the payer -- but the spend notification must still fire
    # unconditionally for any member spend.
    assert svc._repo.last_kwargs["approver_user_id"] == MEMBER_ID
    assert len(notify_calls) == 1
    assert notify_calls[0]["guardian_user_id"] == GUARDIAN_ID
    assert notify_calls[0]["dependent_user_id"] == MEMBER_ID
    assert notify_calls[0]["card_id"] == CARD_ID


def test_unauthorized_non_member_is_forbidden() -> None:
    svc = _service(_cards(), members={(CARD_ID, MEMBER_ID)})
    with pytest.raises(ForbiddenError):
        svc.create(_payload(CARD_ID, RECIPIENT_CARD_ID), user_id=NON_MEMBER_ID)
    assert svc._repo.created is False


def test_overall_cap_breach_blocks_member_spend() -> None:
    breached_rule_repo = _FakeSpendingLimitRuleRepo(
        [
            SimpleNamespace(
                category_id=None,
                period="monthly",
                max_amount=Decimal("5.00"),
                requires_approval_above=None,
                requires_approval_always=False,
            )
        ]
    )
    repo = _FakeRepo(_cards())
    svc = TransactionService(
        repo,
        approval_repo=_NullApprovalRepo(),
        auth_repo=None,
        family_link_repo=_FakeFamilyLinkRepo(),
        spending_limit_rule_repo=breached_rule_repo,
        family_card_member_repo=_FakeFamilyCardMemberRepo({(CARD_ID, MEMBER_ID)}),
    )
    with pytest.raises(SpendingLimitExceededError):
        svc.create(_payload(CARD_ID, RECIPIENT_CARD_ID, amount="50.00"), user_id=MEMBER_ID)
    assert repo.created is False


def test_approval_redirects_to_card_owner_for_member_spend() -> None:
    always_approve_rule_repo = _FakeSpendingLimitRuleRepo(
        [
            SimpleNamespace(
                category_id=None,
                period="monthly",
                max_amount=Decimal("1000.00"),
                requires_approval_above=None,
                requires_approval_always=True,
            )
        ]
    )
    repo = _FakeRepo(_cards())
    svc = TransactionService(
        repo,
        approval_repo=_NullApprovalRepo(),
        auth_repo=None,
        family_link_repo=_FakeFamilyLinkRepo(),
        spending_limit_rule_repo=always_approve_rule_repo,
        family_card_member_repo=_FakeFamilyCardMemberRepo({(CARD_ID, MEMBER_ID)}),
    )
    svc._notify_shared_card_spend = lambda **_kwargs: None
    svc.create(_payload(CARD_ID, RECIPIENT_CARD_ID), user_id=MEMBER_ID)
    assert repo.last_kwargs["requires_user_approval"] is True
    assert repo.last_kwargs["approver_user_id"] == GUARDIAN_ID
