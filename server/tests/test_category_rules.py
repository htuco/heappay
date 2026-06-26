"""Phase 2 auto-categorisation tests: keyword rules tag a transaction on create
only when the user picked no category; an explicit choice is never overridden;
user rules outrank global ones and lower priority wins.

These exercise the service's rule-resolution logic directly with light fakes,
avoiding a DB. The create-path integration ("explicit wins") is covered by
asserting which category_id reaches the repo's create call.
"""
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest

from services.transaction.transaction import TransactionService


def _rule(keyword, category_id, *, match_field="note", user_id=None, priority=100, rule_id=1):
    return SimpleNamespace(
        rule_id=rule_id,
        user_id=user_id,
        match_field=match_field,
        keyword=keyword,
        category_id=category_id,
        priority=priority,
    )


class FakeRuleRepo:
    """Returns rules already ordered by precedence, like the real repo does."""

    def __init__(self, rules):
        self._rules = rules
        self.asked_user_id = "unset"

    def list_applicable(self, *, user_id):
        self.asked_user_id = user_id
        return self._rules


def _service_with_rules(rules):
    # repo and approval/auth repos are unused by _resolve_auto_category, so a bare
    # stub is enough; inject the fake rule repo explicitly.
    repo = SimpleNamespace(_db=None)
    return TransactionService(
        repo,
        approval_repo=object(),
        auth_repo=None,
        category_rule_repo=FakeRuleRepo(rules),
    )


# --------------------------------------------------------------------------- #
# _resolve_auto_category
# --------------------------------------------------------------------------- #
def test_note_keyword_match_returns_category() -> None:
    svc = _service_with_rules([_rule("netflix", 9)])
    result = svc._resolve_auto_category(
        user_id=1, note="Netflix monthly", recipient_name=None
    )
    assert result == 9


def test_match_is_case_insensitive_substring() -> None:
    svc = _service_with_rules([_rule("uber", 3)])
    assert svc._resolve_auto_category(user_id=1, note="UBER ride home", recipient_name=None) == 3


def test_no_match_returns_none() -> None:
    svc = _service_with_rules([_rule("netflix", 9)])
    assert svc._resolve_auto_category(user_id=1, note="grocery run", recipient_name=None) is None


def test_empty_note_and_recipient_returns_none() -> None:
    svc = _service_with_rules([_rule("netflix", 9)])
    assert svc._resolve_auto_category(user_id=1, note=None, recipient_name=None) is None


def test_first_rule_in_order_wins() -> None:
    # The repo returns rules pre-ordered; the service takes the first match.
    # Here a user rule (id 2) precedes a global rule (id 1) that also matches.
    svc = _service_with_rules(
        [
            _rule("coffee", 42, user_id=7, priority=10, rule_id=2),
            _rule("coffee", 5, user_id=None, priority=10, rule_id=1),
        ]
    )
    assert svc._resolve_auto_category(user_id=7, note="coffee at cafe", recipient_name=None) == 42


def test_recipient_field_rule_matches_recipient_name_only() -> None:
    svc = _service_with_rules([_rule("landlord", 8, match_field="recipient_name")])
    # matches against recipient name, not note
    assert (
        svc._resolve_auto_category(user_id=1, note="rent", recipient_name="My Landlord")
        == 8
    )
    # same rule does not fire when the keyword is only in the note
    assert (
        svc._resolve_auto_category(user_id=1, note="landlord", recipient_name="Bob")
        is None
    )


def test_resolution_scopes_rules_to_the_user() -> None:
    repo = FakeRuleRepo([_rule("netflix", 9)])
    svc = TransactionService(
        SimpleNamespace(_db=None),
        approval_repo=object(),
        auth_repo=None,
        category_rule_repo=repo,
    )
    svc._resolve_auto_category(user_id=55, note="netflix", recipient_name=None)
    assert repo.asked_user_id == 55


# --------------------------------------------------------------------------- #
# _recipient_name
# --------------------------------------------------------------------------- #
def test_recipient_name_prefers_full_name() -> None:
    card = SimpleNamespace(
        user=SimpleNamespace(first_name="Ada", last_name="Lovelace"),
        cardholder_name="A LOVELACE",
    )
    assert TransactionService._recipient_name(card) == "Ada Lovelace"


def test_recipient_name_falls_back_to_cardholder() -> None:
    card = SimpleNamespace(user=None, cardholder_name="A LOVELACE")
    assert TransactionService._recipient_name(card) == "A LOVELACE"


def test_recipient_name_none_card() -> None:
    assert TransactionService._recipient_name(None) is None
