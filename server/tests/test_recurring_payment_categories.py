"""Tests for categories on recurring payments: the field on create / update,
and — the one that matters — the category the scheduler stamps onto every
transaction it generates from a rule.

Route tests follow the repo's fake-service + dependency-override style. The
`run_due_payments` tests drive the real service against fake repositories, since
the whole point is the wiring between the rule, the keyword rules and the
created transaction.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from routes.dependencies import get_current_user_id, require_verified_user  # noqa: E402
from routes.recurring_payment.recurring_payment import (  # noqa: E402
    get_recurring_payment_service,
)
from services.recurring_payment.recurring_payment import (  # noqa: E402
    RecurringPaymentCategoryError,
    RecurringPaymentService,
)

_NOW = datetime.now(timezone.utc)
_USER_ID = 10
_GROCERIES = 1
_SUBSCRIPTIONS = 9
_MISSING_CATEGORY = 9999


# --------------------------------------------------------------------------- #
# Fakes
# --------------------------------------------------------------------------- #
class _FakeUser:
    def __init__(self) -> None:
        self.user_id = _USER_ID
        self.email = "user@example.com"
        self.first_name = "Test"
        self.last_name = "User"
        self.avatar_url = None


class _FakeCard:
    def __init__(self, card_id: int, *, balance: str = "500.00") -> None:
        self.card_id = card_id
        self.user_id = _USER_ID
        self.last_four = "4242"
        self.cardholder_name = "Test User"
        self.balance = Decimal(balance)
        self.status_id = 1
        self.user = _FakeUser()
        self.card_type = type("CardType", (), {"vendor": "visa"})()


class _FakeRule:
    def __init__(
        self,
        *,
        recurring_payment_id: int = 1,
        category_id: int | None = None,
        note: str | None = None,
        amount: str = "25.00",
    ) -> None:
        self.recurring_payment_id = recurring_payment_id
        self.user_id = _USER_ID
        self.sender_card_id = 1
        self.recipient_card_id = 2
        self.amount = Decimal(amount)
        self.day_of_month = 5
        self.months = None
        self.note = note
        self.category_id = category_id
        self.status = "active"
        self.next_due_at = date(2026, 1, 5)
        self.last_run_failed = False
        self.last_run_error = None
        self.created_at = _NOW
        self.cancelled_at = None
        self.sender_card = _FakeCard(1)
        self.recipient_card = _FakeCard(2)

    @property
    def months_list(self):
        return None


class _FakeCategoryRule:
    def __init__(self, keyword: str, category_id: int, match_field: str = "note") -> None:
        self.keyword = keyword
        self.category_id = category_id
        self.match_field = match_field


class FakeCategoryRuleRepository:
    def __init__(self, rules=None) -> None:
        self._rules = rules or []

    def list_applicable(self, *, user_id: int):
        return list(self._rules)


class FakeRecurringRepository:
    """Records writes so tests can assert what the service asked for."""

    _db = None

    def __init__(self, rules=None) -> None:
        self._rules = rules or []
        self.create_kwargs = None
        self.update_calls = []

    def create(self, **kwargs):
        self.create_kwargs = kwargs
        return _FakeRule(category_id=kwargs.get("category_id"))

    def get_by_id(self, recurring_payment_id: int):
        return next(
            (r for r in self._rules if r.recurring_payment_id == recurring_payment_id),
            None,
        )

    def list_for_user(self, user_id: int):
        return list(self._rules)

    def list_due(self, as_of: date):
        return list(self._rules)

    def update(self, row, **kwargs):
        self.update_calls.append(kwargs)
        for key, value in kwargs.items():
            setattr(row, key, value)
        return row

    def cancel(self, row) -> None:
        row.status = "cancelled"


class FakeTransactionRepository:
    """Only the handful of methods the recurring service reaches for."""

    def __init__(self, *, known_categories=(_GROCERIES, _SUBSCRIPTIONS)) -> None:
        self._known_categories = set(known_categories)
        self.created_transactions = []
        self.cards = {1: _FakeCard(1), 2: _FakeCard(2)}

    def transaction_category_exists(self, category_id: int) -> bool:
        return category_id in self._known_categories

    def get_card_for_update(self, card_id: int):
        return self.cards.get(card_id)

    def get_transaction_type_id_by_name(self, name: str) -> int:
        return 1

    def get_status_id_by_name(self, name: str) -> int:
        return 1

    def get_card_status_id_by_name(self, name: str):
        return 99  # no card is frozen

    def create_recurring_transaction(self, **kwargs):
        self.created_transactions.append(kwargs)
        return object()


class FakeRecurringService:
    """Route-level double: records the parsed payload, can raise on demand."""

    def __init__(self) -> None:
        self.create_payload = None
        self.update_payload = None
        self.raise_category_error = False

    def create(self, payload, *, user_id):
        self.create_payload = payload
        if self.raise_category_error:
            raise RecurringPaymentCategoryError()
        return _FakeRule(category_id=payload.category_id)

    def update(self, recurring_payment_id, payload, *, user_id):
        self.update_payload = payload
        if self.raise_category_error:
            raise RecurringPaymentCategoryError()
        return _FakeRule(
            recurring_payment_id=recurring_payment_id,
            category_id=payload.category_id,
        )


def _client(service: FakeRecurringService) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_recurring_payment_service] = lambda: service
    app.dependency_overrides[get_current_user_id] = lambda: _USER_ID
    app.dependency_overrides[require_verified_user] = lambda: _USER_ID
    return TestClient(app)


def _create_body(**overrides) -> dict:
    return {
        "sender_card_id": 1,
        "recipient_card_id": 2,
        "amount": "25.00",
        "day_of_month": 5,
        **overrides,
    }


def _service(rules=None, *, tx_repo=None, category_rules=None):
    repo = FakeRecurringRepository(rules)
    tx = tx_repo or FakeTransactionRepository()
    return (
        RecurringPaymentService(
            repo,
            tx,
            FakeCategoryRuleRepository(category_rules),
        ),
        repo,
        tx,
    )


# --------------------------------------------------------------------------- #
# Create
# --------------------------------------------------------------------------- #
def test_create_with_valid_category_persists_it() -> None:
    service = FakeRecurringService()
    client = _client(service)
    response = client.post("/recurring-payments", json=_create_body(category_id=_GROCERIES))
    assert response.status_code == 201
    assert service.create_payload.category_id == _GROCERIES
    assert response.json()["data"]["category_id"] == _GROCERIES


def test_create_without_category_is_uncategorised() -> None:
    service = FakeRecurringService()
    client = _client(service)
    response = client.post("/recurring-payments", json=_create_body())
    assert response.status_code == 201
    assert service.create_payload.category_id is None
    assert response.json()["data"]["category_id"] is None


def test_create_with_unknown_category_is_rejected() -> None:
    service = FakeRecurringService()
    service.raise_category_error = True
    client = _client(service)
    response = client.post(
        "/recurring-payments", json=_create_body(category_id=_MISSING_CATEGORY)
    )
    assert response.status_code == 404
    # Same wording a bad category gets on the transaction routes.
    assert response.json()["message"] == "Transaction category not found."


def test_service_create_validates_and_forwards_the_category() -> None:
    from schemas.recurring_payment import RecurringPaymentCreate

    service, repo, _ = _service()
    payload = RecurringPaymentCreate(**_create_body(category_id=_GROCERIES))
    service.create(payload, user_id=_USER_ID)
    assert repo.create_kwargs["category_id"] == _GROCERIES

    unknown = RecurringPaymentCreate(**_create_body(category_id=_MISSING_CATEGORY))
    with pytest.raises(RecurringPaymentCategoryError):
        service.create(unknown, user_id=_USER_ID)


# --------------------------------------------------------------------------- #
# Update — set / clear / leave alone
# --------------------------------------------------------------------------- #
def test_patch_setting_a_category_reaches_the_service() -> None:
    service = FakeRecurringService()
    client = _client(service)
    response = client.patch("/recurring-payments/1", json={"category_id": _SUBSCRIPTIONS})
    assert response.status_code == 200
    assert service.update_payload.category_id == _SUBSCRIPTIONS
    assert response.json()["data"]["category_id"] == _SUBSCRIPTIONS


def test_patch_with_unknown_category_is_rejected() -> None:
    service = FakeRecurringService()
    service.raise_category_error = True
    client = _client(service)
    response = client.patch("/recurring-payments/1", json={"category_id": _MISSING_CATEGORY})
    assert response.status_code == 404
    assert response.json()["message"] == "Transaction category not found."


def test_update_with_explicit_null_clears_the_category() -> None:
    from schemas.recurring_payment import RecurringPaymentUpdate

    rule = _FakeRule(category_id=_GROCERIES)
    service, repo, _ = _service([rule])
    # model_validate (not the constructor) so `category_id` lands in
    # model_fields_set exactly as it would from a real request body.
    payload = RecurringPaymentUpdate.model_validate({"category_id": None})
    service.update(1, payload, user_id=_USER_ID)
    assert repo.update_calls == [{"category_id": None}]
    assert rule.category_id is None


def test_update_omitting_the_key_leaves_the_category_alone() -> None:
    from schemas.recurring_payment import RecurringPaymentUpdate

    rule = _FakeRule(category_id=_GROCERIES)
    service, repo, _ = _service([rule])
    payload = RecurringPaymentUpdate.model_validate({"note": "Rent"})
    service.update(1, payload, user_id=_USER_ID)
    assert repo.update_calls == [{"note": "Rent"}]
    assert rule.category_id == _GROCERIES


def test_update_rejects_an_unknown_category() -> None:
    from schemas.recurring_payment import RecurringPaymentUpdate

    rule = _FakeRule()
    service, repo, _ = _service([rule])
    payload = RecurringPaymentUpdate.model_validate({"category_id": _MISSING_CATEGORY})
    with pytest.raises(RecurringPaymentCategoryError):
        service.update(1, payload, user_id=_USER_ID)
    assert repo.update_calls == []


def test_category_write_does_not_touch_amount_status_or_next_due() -> None:
    from schemas.recurring_payment import RecurringPaymentUpdate

    rule = _FakeRule()
    before = (rule.amount, rule.status, rule.next_due_at)
    service, _, _ = _service([rule])
    service.update(
        1,
        RecurringPaymentUpdate.model_validate({"category_id": _GROCERIES}),
        user_id=_USER_ID,
    )
    assert (rule.amount, rule.status, rule.next_due_at) == before
    assert rule.category_id == _GROCERIES


# --------------------------------------------------------------------------- #
# The scheduler — the acceptance-critical path
# --------------------------------------------------------------------------- #
def test_run_due_payments_stamps_the_rules_category() -> None:
    rule = _FakeRule(category_id=_SUBSCRIPTIONS, note="Netflix")
    service, _, tx_repo = _service([rule])

    result = service.run_due_payments()

    assert result["recurring_created"] == 1
    assert tx_repo.created_transactions[0]["category_id"] == _SUBSCRIPTIONS


def test_an_explicit_category_wins_over_a_matching_keyword_rule() -> None:
    # The note would match a rule pointing at groceries; the rule's own category
    # must still be the one that lands.
    rule = _FakeRule(category_id=_SUBSCRIPTIONS, note="Weekly groceries")
    service, _, tx_repo = _service(
        [rule], category_rules=[_FakeCategoryRule("groceries", _GROCERIES)]
    )

    service.run_due_payments()

    assert tx_repo.created_transactions[0]["category_id"] == _SUBSCRIPTIONS


def test_a_rule_without_a_category_falls_back_to_the_keyword_rules() -> None:
    rule = _FakeRule(category_id=None, note="Spotify subscription")
    service, _, tx_repo = _service(
        [rule], category_rules=[_FakeCategoryRule("spotify", _SUBSCRIPTIONS)]
    )

    service.run_due_payments()

    assert tx_repo.created_transactions[0]["category_id"] == _SUBSCRIPTIONS


def test_a_rule_with_no_category_and_no_keyword_match_stays_uncategorised() -> None:
    rule = _FakeRule(category_id=None, note="Something else entirely")
    service, _, tx_repo = _service(
        [rule], category_rules=[_FakeCategoryRule("spotify", _SUBSCRIPTIONS)]
    )

    service.run_due_payments()

    assert tx_repo.created_transactions[0]["category_id"] is None


def test_the_category_does_not_alter_the_generated_payment() -> None:
    """Category is pure metadata: same amount, same schedule advance, same run
    bookkeeping whether or not the rule carries one."""
    categorised = _FakeRule(category_id=_SUBSCRIPTIONS, note="Netflix")
    plain = _FakeRule(category_id=None, note="Netflix")

    service_a, repo_a, tx_a = _service([categorised])
    service_b, repo_b, tx_b = _service([plain])
    service_a.run_due_payments()
    service_b.run_due_payments()

    created_a = tx_a.created_transactions[0]
    created_b = tx_b.created_transactions[0]
    assert created_a["amount"] == created_b["amount"] == Decimal("25.00")
    assert created_a["note"] == created_b["note"]
    assert categorised.status == plain.status == "active"
    assert categorised.next_due_at == plain.next_due_at
    assert repo_a.update_calls[0]["next_due_at"] == repo_b.update_calls[0]["next_due_at"]
    assert repo_a.update_calls[0]["last_run_failed"] is False
