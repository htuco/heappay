"""A frozen card must not be able to send or receive money."""

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from schemas.transaction import TransactionCreate
from services.transaction.transaction import (
    CardFrozenError,
    TransactionService,
)

_ACTIVE, _FROZEN = 1, 3


class _Card:
    def __init__(self, card_id: int, *, user_id: int, status_id: int, balance="100.00"):
        self.card_id = card_id
        self.user_id = user_id
        self.status_id = status_id
        self.balance = Decimal(balance)
        self.deleted_at = None
        self.expires_at = date(2030, 12, 31)
        self.is_main = card_id == 1


class _FakeRepo:
    """Just enough of TransactionRepository for TransactionService.create()."""

    def __init__(self, cards: dict[int, _Card]):
        self._cards = cards
        self.created = False

    def get_by_idempotency_key(self, key):
        return None

    def transaction_type_exists(self, type_id):
        return True

    def get_status_id_by_name(self, name):
        return {"pending": 10}.get(name)

    def get_card_status_id_by_name(self, name):
        return {"active": _ACTIVE, "frozen": _FROZEN}.get(name)

    def get_card_for_update(self, card_id):
        return self._cards.get(card_id)

    def create_with_balance_update(self, **kwargs):
        self.created = True

        class _Tx:
            transaction_id = 1

        return _Tx()


def _service(cards):
    svc = TransactionService.__new__(TransactionService)
    svc._repo = _FakeRepo(cards)
    return svc


def _payload(sender_id, recipient_id):
    return TransactionCreate(
        sender_card_id=sender_id,
        recipient_card_id=recipient_id,
        transaction_type_id=1,
        amount=Decimal("10.00"),
        note=None,
        idempotency_key=None,
    )


def test_frozen_sender_card_is_rejected():
    cards = {
        1: _Card(1, user_id=1, status_id=_FROZEN),
        2: _Card(2, user_id=2, status_id=_ACTIVE),
    }
    svc = _service(cards)
    with pytest.raises(CardFrozenError) as exc:
        svc.create(_payload(1, 2), user_id=1)
    assert exc.value.side == "sender"
    assert svc._repo.created is False


def test_frozen_recipient_card_is_rejected():
    cards = {
        1: _Card(1, user_id=1, status_id=_ACTIVE),
        2: _Card(2, user_id=2, status_id=_FROZEN),
    }
    svc = _service(cards)
    with pytest.raises(CardFrozenError) as exc:
        svc.create(_payload(1, 2), user_id=1)
    assert exc.value.side == "recipient"
    assert svc._repo.created is False


def test_active_cards_are_allowed():
    cards = {
        1: _Card(1, user_id=1, status_id=_ACTIVE),
        2: _Card(2, user_id=2, status_id=_ACTIVE),
    }
    svc = _service(cards)
    row, created = svc.create(_payload(1, 2), user_id=1)
    assert created is True
    assert svc._repo.created is True
