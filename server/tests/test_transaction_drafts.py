"""Tests for draft payments: a payment saved to finish later.

The point of the feature is what a draft *doesn't* do. Saving one must not move
money, hold money, or become visible to anything that counts money, and sending
one must go through the ordinary transaction create path rather than a second
copy of it. So the tests here are mostly about absence:

  * `FakeTransactionRepository` blows up if a draft operation so much as looks
    at a balance, an escrow or the transaction table.
  * the send tests assert the draft survives every failure, and is consumed on
    exactly one outcome -- success.

Route tests follow the repo's fake-service + dependency-override style.
"""
from datetime import datetime, timezone
from decimal import Decimal
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from models.transaction_draft import TransactionDraft  # noqa: E402
from routes.dependencies import get_current_user_id, require_verified_user  # noqa: E402
from routes.transaction_draft.transaction_draft import (  # noqa: E402
    get_transaction_draft_service,
)
from schemas.transaction_draft import (  # noqa: E402
    TransactionDraftCreate,
    TransactionDraftResponse,
    TransactionDraftSendRequest,
    TransactionDraftUpdate,
)
from services.transaction.transaction import (  # noqa: E402
    CardFrozenError,
    InsufficientBalanceError,
)
from services.transaction_draft.transaction_draft import (  # noqa: E402
    MAX_DRAFTS_PER_USER,
    TransactionDraftCardError,
    TransactionDraftForbiddenError,
    TransactionDraftIncompleteError,
    TransactionDraftLimitReachedError,
    TransactionDraftNotFoundError,
    TransactionDraftService,
)

_USER_ID = 7
_OTHER_USER_ID = 8
_PAYMENT_TYPE_ID = 1
_TRANSACTIONS_TABLE = "transactions"


# ── doubles ───────────────────────────────────────────────────────────────────


class _FakeCard:
    def __init__(self, card_id: int, user_id: int = _USER_ID) -> None:
        self.card_id = card_id
        self.user_id = user_id


class _FakeUser:
    user_id = _USER_ID
    email = "owner@example.com"
    avatar_url = None
    first_name = "Ada"
    last_name = "Lovelace"


class _FakeCardType:
    vendor = "visa"


class _FakePartyCard:
    """A card fat enough for the transaction serialiser to render it."""

    def __init__(self, card_id: int) -> None:
        self.card_id = card_id
        self.user_id = _USER_ID
        self.last_four = "4242"
        self.cardholder_name = "Ada Lovelace"
        self.card_type = _FakeCardType()
        self.user = _FakeUser()


class _FakeTransaction:
    """What the create path hands back once a draft has been sent."""

    def __init__(self, transaction_id: int = 99) -> None:
        self.transaction_id = transaction_id
        self.sender_card_id = 1
        self.recipient_card_id = 2
        self.recurring_payment_id = None
        self.transaction_type_id = _PAYMENT_TYPE_ID
        self.status_id = 1
        self.category_id = None
        self.amount = Decimal("25.00")
        self.note = "Lunch"
        self.created_at = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
        self.processing_eligible_at = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
        self.processed_at = None
        self.processed_by = None
        self.deny_reason_code = None
        self.requires_user_approval = False
        self.user_approval_expires_at = None
        self.user_approved_at = None
        self.user_approval_method = None
        self.refund_detail = None
        self.sender_card = _FakePartyCard(1)
        self.recipient_card = _FakePartyCard(2)


class _FakeDraft:
    def __init__(
        self,
        draft_id: int = 1,
        *,
        user_id: int = _USER_ID,
        sender_card_id: int | None = 1,
        recipient_card_id: int | None = 2,
        transaction_type_id: int | None = _PAYMENT_TYPE_ID,
        category_id: int | None = None,
        amount: Decimal | None = Decimal("25.00"),
        note: str | None = "Lunch",
    ) -> None:
        self.draft_id = draft_id
        self.user_id = user_id
        self.sender_card_id = sender_card_id
        self.recipient_card_id = recipient_card_id
        self.transaction_type_id = transaction_type_id
        self.category_id = category_id
        self.amount = amount
        self.note = note
        self.created_at = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
        self.updated_at = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
        self.sender_card = None
        self.recipient_card = None


class FakeDraftRepository:
    def __init__(self, drafts=None, cards=None) -> None:
        self.drafts = {d.draft_id: d for d in (drafts or [])}
        self.cards = cards if cards is not None else {
            1: _FakeCard(1),
            2: _FakeCard(2, user_id=_OTHER_USER_ID),
        }
        self.deleted: list[int] = []
        self._next_id = max(self.drafts, default=0) + 1

    def get_card(self, card_id: int):
        return self.cards.get(card_id)

    def create(self, *, user_id: int, **fields):
        row = _FakeDraft(self._next_id, user_id=user_id, **fields)
        self.drafts[row.draft_id] = row
        self._next_id += 1
        return row

    def get_by_id(self, draft_id: int):
        return self.drafts.get(draft_id)

    def list_for_user(self, user_id: int):
        return [d for d in self.drafts.values() if d.user_id == user_id]

    def count_for_user(self, user_id: int) -> int:
        return len(self.list_for_user(user_id))

    def update(self, row, **fields):
        for key, value in fields.items():
            setattr(row, key, value)
        return row

    def delete(self, row) -> None:
        self.deleted.append(row.draft_id)
        self.drafts.pop(row.draft_id, None)


class FakeTransactionRepository:
    """Answers reference lookups; refuses to do anything money-shaped.

    Every method a draft has no business calling raises, so a future change
    that quietly wires a draft into balances or escrow fails here rather than
    in production.
    """

    def __init__(self) -> None:
        self.known_categories = {3}
        self.known_types = {_PAYMENT_TYPE_ID}

    def transaction_category_exists(self, category_id: int) -> bool:
        return category_id in self.known_categories

    def transaction_type_exists(self, transaction_type_id: int) -> bool:
        return transaction_type_id in self.known_types

    def get_transaction_type_id_by_name(self, name: str) -> int:
        return _PAYMENT_TYPE_ID

    def _forbidden(self, *args, **kwargs):
        raise AssertionError("A draft operation touched the money path")

    get_card_for_update = _forbidden
    create_with_balance_update = _forbidden
    list_for_user = _forbidden
    count_for_user = _forbidden
    get_by_idempotency_key = _forbidden
    find_recent_duplicate = _forbidden
    complete = _forbidden
    fail = _forbidden


class FakeFamilyCardMemberRepository:
    def __init__(self, member_card_ids=()) -> None:
        self.member_card_ids = set(member_card_ids)

    def is_member(self, *, card_id: int, dependent_user_id: int) -> bool:
        return card_id in self.member_card_ids


class FakeTransactionService:
    """Stands in for the real create path: records, or raises what it is told."""

    def __init__(self, raises: Exception | None = None) -> None:
        self.raises = raises
        self.payloads: list = []

    def create(self, payload, *, user_id: int):
        self.payloads.append((payload, user_id))
        if self.raises is not None:
            raise self.raises
        return _FakeTransaction(), True


def _service(
    *,
    drafts=None,
    cards=None,
    tx_service: FakeTransactionService | None = None,
    member_card_ids=(),
) -> tuple[TransactionDraftService, FakeDraftRepository, FakeTransactionService]:
    repo = FakeDraftRepository(drafts=drafts, cards=cards)
    tx_service = tx_service or FakeTransactionService()
    service = TransactionDraftService(
        repo,
        FakeTransactionRepository(),
        tx_service,
        FakeFamilyCardMemberRepository(member_card_ids),
    )
    return service, repo, tx_service


# ── saving a draft moves no money ─────────────────────────────────────────────


def test_saving_a_draft_never_touches_the_money_path():
    """FakeTransactionRepository raises on every balance/escrow/history call."""
    service, repo, _ = _service()

    row = service.create(
        TransactionDraftCreate(
            sender_card_id=1, recipient_card_id=2, amount="25.00", note="Lunch"
        ),
        user_id=_USER_ID,
    )

    assert row.amount == Decimal("25.00")
    assert repo.count_for_user(_USER_ID) == 1


def test_listing_updating_and_discarding_never_touch_the_money_path():
    service, repo, _ = _service(drafts=[_FakeDraft(1)])

    assert len(service.list_for_user(user_id=_USER_ID)) == 1
    service.update(1, TransactionDraftUpdate(amount="30.00"), user_id=_USER_ID)
    service.delete(1, user_id=_USER_ID)

    assert repo.deleted == [1]
    assert repo.count_for_user(_USER_ID) == 0


def test_a_draft_is_not_a_transaction():
    """The exclusion strategy in one assertion: separate table, separate model.

    Nothing filters drafts out of balances, history, summaries or exports
    because nothing has to -- they are not in `transactions` to begin with.
    """
    assert TransactionDraft.__tablename__ == "transaction_drafts"
    assert TransactionDraft.__tablename__ != _TRANSACTIONS_TABLE
    assert not hasattr(TransactionDraft, "status_id")


def test_a_draft_may_be_incomplete():
    service, _, _ = _service()

    row = service.create(TransactionDraftCreate(recipient_card_id=2), user_id=_USER_ID)

    assert row.amount is None
    assert row.sender_card_id is None


def test_incomplete_draft_is_reported_as_not_sendable():
    response = TransactionDraftResponse.model_validate(
        _FakeDraft(1, amount=None), from_attributes=True
    )
    assert response.is_sendable is False

    complete = TransactionDraftResponse.model_validate(_FakeDraft(1))
    assert complete.is_sendable is True


# ── ownership and limits ──────────────────────────────────────────────────────


def test_another_users_draft_is_not_readable_writable_or_sendable():
    theirs = _FakeDraft(1, user_id=_OTHER_USER_ID)
    service, repo, tx_service = _service(drafts=[theirs])

    with pytest.raises(TransactionDraftForbiddenError):
        service.get_by_id_for_user(1, user_id=_USER_ID)
    with pytest.raises(TransactionDraftForbiddenError):
        service.update(1, TransactionDraftUpdate(note="mine now"), user_id=_USER_ID)
    with pytest.raises(TransactionDraftForbiddenError):
        service.delete(1, user_id=_USER_ID)
    with pytest.raises(TransactionDraftForbiddenError):
        service.send(1, TransactionDraftSendRequest(), user_id=_USER_ID)

    assert repo.deleted == []
    assert tx_service.payloads == []


def test_missing_draft_raises_not_found():
    service, _, _ = _service()

    with pytest.raises(TransactionDraftNotFoundError):
        service.get_by_id_for_user(404, user_id=_USER_ID)


def test_drafts_are_capped_per_user():
    existing = [_FakeDraft(i) for i in range(1, MAX_DRAFTS_PER_USER + 1)]
    service, _, _ = _service(drafts=existing)

    with pytest.raises(TransactionDraftLimitReachedError):
        service.create(TransactionDraftCreate(recipient_card_id=2), user_id=_USER_ID)


def test_draft_cannot_spend_from_a_card_the_user_cannot_use():
    cards = {1: _FakeCard(1, user_id=_OTHER_USER_ID), 2: _FakeCard(2)}
    service, _, _ = _service(cards=cards)

    with pytest.raises(TransactionDraftCardError):
        service.create(
            TransactionDraftCreate(sender_card_id=1, recipient_card_id=2),
            user_id=_USER_ID,
        )


def test_draft_may_spend_from_an_authorized_shared_card():
    """Same two cases `TransactionService.create` allows, so a saved draft sends."""
    cards = {1: _FakeCard(1, user_id=_OTHER_USER_ID), 2: _FakeCard(2)}
    service, _, _ = _service(cards=cards, member_card_ids={1})

    row = service.create(
        TransactionDraftCreate(sender_card_id=1, recipient_card_id=2),
        user_id=_USER_ID,
    )

    assert row.sender_card_id == 1


# ── updating ──────────────────────────────────────────────────────────────────


def test_update_only_changes_what_was_sent():
    service, _, _ = _service(drafts=[_FakeDraft(1)])

    row = service.update(1, TransactionDraftUpdate(amount="40.00"), user_id=_USER_ID)

    assert row.amount == Decimal("40.00")
    assert row.note == "Lunch"
    assert row.recipient_card_id == 2


def test_update_can_clear_a_field_explicitly():
    """Every field is nullable, so an explicit null has to mean something."""
    service, _, _ = _service(drafts=[_FakeDraft(1)])

    row = service.update(1, TransactionDraftUpdate(note=None), user_id=_USER_ID)

    assert row.note is None
    assert row.amount == Decimal("25.00")


# ── sending ───────────────────────────────────────────────────────────────────


def test_sending_goes_through_the_normal_create_path_and_consumes_the_draft():
    service, repo, tx_service = _service(drafts=[_FakeDraft(1)])

    transaction, created = service.send(1, TransactionDraftSendRequest(), user_id=_USER_ID)

    assert created is True
    assert transaction.transaction_id == 99
    payload, user_id = tx_service.payloads[0]
    assert user_id == _USER_ID
    assert payload.recipient_card_id == 2
    assert payload.amount == Decimal("25.00")
    assert payload.note == "Lunch"
    assert repo.deleted == [1]


def test_a_failed_send_leaves_the_draft_intact():
    service, repo, _ = _service(
        drafts=[_FakeDraft(1)], tx_service=FakeTransactionService(InsufficientBalanceError())
    )

    with pytest.raises(InsufficientBalanceError):
        service.send(1, TransactionDraftSendRequest(), user_id=_USER_ID)

    assert repo.deleted == []
    assert repo.get_by_id(1) is not None


def test_a_frozen_card_send_leaves_the_draft_intact():
    service, repo, _ = _service(
        drafts=[_FakeDraft(1)], tx_service=FakeTransactionService(CardFrozenError("sender"))
    )

    with pytest.raises(CardFrozenError):
        service.send(1, TransactionDraftSendRequest(), user_id=_USER_ID)

    assert repo.get_by_id(1) is not None


def test_sending_an_incomplete_draft_is_refused_before_the_create_path():
    service, repo, tx_service = _service(drafts=[_FakeDraft(1, amount=None)])

    with pytest.raises(TransactionDraftIncompleteError):
        service.send(1, TransactionDraftSendRequest(), user_id=_USER_ID)

    assert tx_service.payloads == []
    assert repo.get_by_id(1) is not None


def test_sending_a_draft_without_a_recipient_is_refused():
    service, _, tx_service = _service(drafts=[_FakeDraft(1, recipient_card_id=None)])

    with pytest.raises(TransactionDraftIncompleteError):
        service.send(1, TransactionDraftSendRequest(), user_id=_USER_ID)

    assert tx_service.payloads == []


def test_send_overrides_win_over_stored_values():
    """The wizard sends what the user just edited; the draft fills in the rest."""
    service, _, tx_service = _service(drafts=[_FakeDraft(1)])

    service.send(
        1,
        TransactionDraftSendRequest(amount="99.00", app_pin="1234"),
        user_id=_USER_ID,
    )

    payload, _ = tx_service.payloads[0]
    assert payload.amount == Decimal("99.00")
    assert payload.note == "Lunch"  # untouched fields still come from the draft
    assert payload.app_pin == "1234"


def test_send_falls_back_to_the_payment_type_when_the_draft_has_none():
    service, _, tx_service = _service(drafts=[_FakeDraft(1, transaction_type_id=None)])

    service.send(1, TransactionDraftSendRequest(), user_id=_USER_ID)

    payload, _ = tx_service.payloads[0]
    assert payload.transaction_type_id == _PAYMENT_TYPE_ID


def test_credentials_are_passed_through_to_the_create_path():
    service, _, tx_service = _service(drafts=[_FakeDraft(1)])

    service.send(
        1,
        TransactionDraftSendRequest(totp_code="123456", idempotency_key="abc"),
        user_id=_USER_ID,
    )

    payload, _ = tx_service.payloads[0]
    assert payload.totp_code == "123456"
    assert payload.idempotency_key == "abc"


# ── routes ────────────────────────────────────────────────────────────────────


class FakeDraftService:
    """Route-level double: records what was parsed, raises on demand."""

    def __init__(self, *, raises: Exception | None = None) -> None:
        self.raises = raises
        self.create_payload = None
        self.update_payload = None
        self.send_payload = None
        self.deleted: list[int] = []

    def _maybe_raise(self):
        if self.raises is not None:
            raise self.raises

    def create(self, payload, *, user_id):
        self.create_payload = payload
        self._maybe_raise()
        return _FakeDraft(1)

    def list_for_user(self, *, user_id):
        self._maybe_raise()
        return [_FakeDraft(1), _FakeDraft(2, amount=None)]

    def get_by_id_for_user(self, draft_id, *, user_id):
        self._maybe_raise()
        return _FakeDraft(draft_id)

    def update(self, draft_id, payload, *, user_id):
        self.update_payload = payload
        self._maybe_raise()
        return _FakeDraft(draft_id)

    def delete(self, draft_id, *, user_id):
        self._maybe_raise()
        self.deleted.append(draft_id)

    def send(self, draft_id, payload, *, user_id):
        self.send_payload = payload
        self._maybe_raise()
        return _FakeTransaction(), True


def _client(service: FakeDraftService) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_transaction_draft_service] = lambda: service
    app.dependency_overrides[get_current_user_id] = lambda: _USER_ID
    app.dependency_overrides[require_verified_user] = lambda: _USER_ID
    return TestClient(app)


def test_route_create_returns_201():
    service = FakeDraftService()
    response = _client(service).post(
        "/transaction-drafts", json={"recipient_card_id": 2, "amount": "25.00"}
    )

    assert response.status_code == 201
    assert service.create_payload.amount == Decimal("25.00")


def test_route_create_accepts_an_empty_draft():
    service = FakeDraftService()
    response = _client(service).post("/transaction-drafts", json={})

    assert response.status_code == 201
    assert service.create_payload.recipient_card_id is None


def test_route_list_marks_which_drafts_can_be_sent():
    response = _client(FakeDraftService()).get("/transaction-drafts")

    assert response.status_code == 200
    drafts = response.json()["data"]
    assert [d["is_sendable"] for d in drafts] == [True, False]


def test_route_reports_the_draft_cap_as_a_conflict():
    service = FakeDraftService(raises=TransactionDraftLimitReachedError())
    response = _client(service).post("/transaction-drafts", json={"amount": "5.00"})

    assert response.status_code == 409
    assert str(MAX_DRAFTS_PER_USER) in response.json()["message"]


def test_route_missing_draft_is_404():
    service = FakeDraftService(raises=TransactionDraftNotFoundError())
    response = _client(service).get("/transaction-drafts/1")

    assert response.status_code == 404


def test_route_other_users_draft_is_403():
    service = FakeDraftService(raises=TransactionDraftForbiddenError())
    response = _client(service).delete("/transaction-drafts/1")

    assert response.status_code == 403


def test_route_discard_returns_success():
    service = FakeDraftService()
    response = _client(service).delete("/transaction-drafts/1")

    assert response.status_code == 200
    assert service.deleted == [1]


def test_route_send_returns_the_created_transaction():
    service = FakeDraftService()
    response = _client(service).post("/transaction-drafts/1/send", json={"app_pin": "1234"})

    assert response.status_code == 201
    assert response.json()["data"]["transaction_id"] == 99
    assert service.send_payload.app_pin == "1234"


def test_route_send_reports_insufficient_balance_as_400():
    service = FakeDraftService(raises=InsufficientBalanceError())
    response = _client(service).post("/transaction-drafts/1/send", json={})

    assert response.status_code == 400
    assert "insufficient balance" in response.json()["message"].lower()


def test_route_send_reports_an_incomplete_draft_as_400():
    service = FakeDraftService(raises=TransactionDraftIncompleteError("This draft needs an amount."))
    response = _client(service).post("/transaction-drafts/1/send", json={})

    assert response.status_code == 400
    assert response.json()["message"] == "This draft needs an amount."


def test_route_send_rejects_two_confirmation_methods():
    response = _client(FakeDraftService()).post(
        "/transaction-drafts/1/send", json={"app_pin": "1234", "totp_code": "123456"}
    )

    assert response.status_code == 422
