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

    def list_applicable(self, *, dependent_user_id, category_id):
        return self._rules

    def sum_period_spend(self, *, dependent_user_id, category_id, period, now):
        return self._prior_spend


def _service(rules, *, prior_spend=Decimal("0")):
    repo = SimpleNamespace(_db=None)
    return TransactionService(
        repo,
        approval_repo=object(),
        auth_repo=None,
        spending_limit_rule_repo=FakeSpendingLimitRuleRepo(rules, prior_spend=prior_spend),
    )




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
