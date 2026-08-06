"""Spending-limit enforcement tests: `_evaluate_spending_limits` against
independent rule fakes, mirroring the fake-repo style of
`test_category_rules.py` — no DB, direct unit tests of the resolution logic.

Unlike `CategoryRuleRepository.list_applicable` (first-match wins),
`SpendingLimitRuleRepository.list_applicable` returns every applicable rule,
since an overall cap and a category cap are independent constraints that can
both bind on the same transaction.
"""
from decimal import Decimal
from types import SimpleNamespace

from services.transaction.transaction import TransactionService


def _rule(
    *,
    category_id=None,
    period="monthly",
    max_amount="100.00",
    requires_approval_above=None,
    requires_approval_always=False,
):
    return SimpleNamespace(
        category_id=category_id,
        period=period,
        max_amount=Decimal(max_amount),
        requires_approval_above=(
            Decimal(requires_approval_above) if requires_approval_above is not None else None
        ),
        requires_approval_always=requires_approval_always,
    )


class FakeSpendingLimitRuleRepo:
    def __init__(self, rules, *, prior_spend=Decimal("0")):
        self._rules = rules
        self._prior_spend = prior_spend
        self.list_applicable_calls = []
        self.sum_period_spend_calls = []

    def list_applicable(self, *, dependent_user_id, category_id, card_id=None):
        self.list_applicable_calls.append(
            {"dependent_user_id": dependent_user_id, "category_id": category_id, "card_id": card_id}
        )
        return self._rules

    def sum_period_spend(self, *, dependent_user_id, category_id, period, now, card_id=None):
        self.sum_period_spend_calls.append(
            {
                "dependent_user_id": dependent_user_id,
                "category_id": category_id,
                "card_id": card_id,
            }
        )
        return self._prior_spend


def _service(rules, *, prior_spend=Decimal("0")):
    repo = SimpleNamespace(_db=None)
    return TransactionService(
        repo,
        approval_repo=object(),
        auth_repo=None,
        spending_limit_rule_repo=FakeSpendingLimitRuleRepo(rules, prior_spend=prior_spend),
    )


def _service_with_repo(rules, *, prior_spend=Decimal("0")):
    repo = SimpleNamespace(_db=None)
    fake_repo = FakeSpendingLimitRuleRepo(rules, prior_spend=prior_spend)
    svc = TransactionService(
        repo,
        approval_repo=object(),
        auth_repo=None,
        spending_limit_rule_repo=fake_repo,
    )
    return svc, fake_repo


def test_no_applicable_rules_allows() -> None:
    svc = _service([])
    blocked, requires_approval = svc._evaluate_spending_limits(
        dependent_user_id=1, category_id=None, amount=Decimal("50")
    )
    assert (blocked, requires_approval) == (False, False)


def test_breach_with_no_escape_blocks_outright() -> None:
    svc = _service([_rule(max_amount="100.00")], prior_spend=Decimal("80"))
    blocked, requires_approval = svc._evaluate_spending_limits(
        dependent_user_id=1, category_id=None, amount=Decimal("50")
    )
    assert blocked is True
    assert requires_approval is False


def test_under_cap_allows_with_no_approval() -> None:
    svc = _service([_rule(max_amount="100.00")], prior_spend=Decimal("10"))
    blocked, requires_approval = svc._evaluate_spending_limits(
        dependent_user_id=1, category_id=None, amount=Decimal("50")
    )
    assert (blocked, requires_approval) == (False, False)


def test_breach_with_requires_approval_above_configured_routes_to_approval() -> None:
    # Cap is breached, but this rule has an approval escape configured, so it
    # routes to approval instead of an outright block.
    svc = _service(
        [_rule(max_amount="100.00", requires_approval_above="9999.00")],
        prior_spend=Decimal("80"),
    )
    blocked, requires_approval = svc._evaluate_spending_limits(
        dependent_user_id=1, category_id=None, amount=Decimal("50")
    )
    assert (blocked, requires_approval) == (False, True)


def test_amount_above_requires_approval_above_threshold_triggers_approval() -> None:
    # Cap not breached at all, but the single-transaction threshold is.
    svc = _service(
        [_rule(max_amount="1000.00", requires_approval_above="40.00")],
        prior_spend=Decimal("0"),
    )
    blocked, requires_approval = svc._evaluate_spending_limits(
        dependent_user_id=1, category_id=None, amount=Decimal("50")
    )
    assert (blocked, requires_approval) == (False, True)


def test_requires_approval_always_triggers_regardless_of_amount() -> None:
    svc = _service(
        [_rule(max_amount="1000.00", requires_approval_always=True)],
        prior_spend=Decimal("0"),
    )
    blocked, requires_approval = svc._evaluate_spending_limits(
        dependent_user_id=1, category_id=None, amount=Decimal("1")
    )
    assert (blocked, requires_approval) == (False, True)


def test_block_wins_over_approval_from_another_rule() -> None:
    # One rule would only require approval; another breaches with no escape.
    # The block from the second rule must win overall.
    svc = _service(
        [
            _rule(category_id=None, max_amount="1000.00", requires_approval_always=True),
            _rule(category_id=5, max_amount="20.00"),
        ],
        prior_spend=Decimal("100"),
    )
    blocked, requires_approval = svc._evaluate_spending_limits(
        dependent_user_id=1, category_id=5, amount=Decimal("50")
    )
    assert blocked is True


# --------------------------------------------------------------------------- #
# Shared-card scoping: card_id threaded through to both repo calls, and the
# three scopes (dependent's own card / card overall / card member) stay
# distinct exact-match lookups, not the category_id "OR NULL" pattern.
# --------------------------------------------------------------------------- #
def test_default_card_id_is_none_for_dependents_own_card_scope() -> None:
    svc, repo = _service_with_repo([_rule(max_amount="100.00")])
    svc._evaluate_spending_limits(dependent_user_id=1, category_id=None, amount=Decimal("10"))
    assert repo.list_applicable_calls[0] == {
        "dependent_user_id": 1,
        "category_id": None,
        "card_id": None,
    }
    assert repo.sum_period_spend_calls[0]["card_id"] is None
    assert repo.sum_period_spend_calls[0]["dependent_user_id"] == 1


def test_overall_card_cap_scope_passes_card_id_and_none_dependent() -> None:
    svc, repo = _service_with_repo([_rule(max_amount="500.00")])
    svc._evaluate_spending_limits(
        dependent_user_id=None, card_id=42, category_id=None, amount=Decimal("10")
    )
    assert repo.list_applicable_calls[0] == {
        "dependent_user_id": None,
        "category_id": None,
        "card_id": 42,
    }
    assert repo.sum_period_spend_calls[0]["card_id"] == 42
    assert repo.sum_period_spend_calls[0]["dependent_user_id"] is None


def test_per_member_card_scope_passes_both_card_id_and_dependent_id() -> None:
    svc, repo = _service_with_repo([_rule(max_amount="50.00")])
    svc._evaluate_spending_limits(
        dependent_user_id=7, card_id=42, category_id=None, amount=Decimal("10")
    )
    assert repo.list_applicable_calls[0] == {
        "dependent_user_id": 7,
        "category_id": None,
        "card_id": 42,
    }
    assert repo.sum_period_spend_calls[0] == {
        "dependent_user_id": 7,
        "category_id": None,
        "card_id": 42,
    }


def test_overall_cap_breach_blocks_with_no_escape() -> None:
    svc = _service([_rule(max_amount="100.00")], prior_spend=Decimal("90"))
    blocked, requires_approval = svc._evaluate_spending_limits(
        dependent_user_id=None, card_id=1, category_id=None, amount=Decimal("50")
    )
    assert (blocked, requires_approval) == (True, False)


def test_member_cap_independent_from_overall_cap() -> None:
    # A member's own cap on a shared card is a distinct rule set from the
    # card's overall cap -- evaluating one must not see the other's rules.
    overall_repo = FakeSpendingLimitRuleRepo([_rule(max_amount="1000.00")], prior_spend=Decimal("0"))
    member_repo = FakeSpendingLimitRuleRepo([_rule(max_amount="20.00")], prior_spend=Decimal("15"))

    svc = TransactionService(
        SimpleNamespace(_db=None), approval_repo=object(), auth_repo=None,
        spending_limit_rule_repo=overall_repo,
    )
    overall_blocked, _ = svc._evaluate_spending_limits(
        dependent_user_id=None, card_id=1, category_id=None, amount=Decimal("10")
    )
    assert overall_blocked is False

    svc2 = TransactionService(
        SimpleNamespace(_db=None), approval_repo=object(), auth_repo=None,
        spending_limit_rule_repo=member_repo,
    )
    member_blocked, _ = svc2._evaluate_spending_limits(
        dependent_user_id=7, card_id=1, category_id=None, amount=Decimal("10")
    )
    assert member_blocked is True
