"""Tests for the per-card reserved (held funds) derivation.

Reserved is a read-time view of escrow: it is the sum of pending outgoing
transaction amounts for a card. ``card.balance`` is already net of these holds
(the spendable figure), and reserved is surfaced separately. These tests assert
the service passes the derivation through and the response wiring is correct
without altering the balance.
"""

import os
from datetime import date, datetime, timezone
from decimal import Decimal

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from routes.card.card import _to_response  # noqa: E402
from services.card.card import CardService  # noqa: E402


class _FakeCardRepo:
    def __init__(self, reserved: dict[int, Decimal]):
        self._reserved = reserved

    def reserved_by_card_for_user(self, user_id: int) -> dict[int, Decimal]:
        return dict(self._reserved)


class _Row:
    def __init__(self, card_id: int, balance: str):
        self.card_id = card_id
        self.user_id = 1
        self.status_id = 1
        self.card_type_id = 1
        self.last_four = "4242"
        self.expires_at = date(2030, 12, 31)
        self.balance = Decimal(balance)
        self.cardholder_name = "Card Holder"
        self.created_at = datetime.now(timezone.utc)
        self.deleted_at = None
        self.is_main = True


def test_service_returns_reserved_map():
    repo = _FakeCardRepo({1: Decimal("50.00")})
    service = CardService(repo)  # type: ignore[arg-type]
    assert service.reserved_by_card_for_user(1) == {1: Decimal("50.00")}


def test_response_carries_reserved_without_touching_balance():
    # Sender sent $50 (already debited on create) → balance is the spendable
    # figure; reserved surfaces the in-flight $50 separately, without altering it.
    row = _Row(card_id=1, balance="50.00")
    resp = _to_response(row, has_pending=True, reserved=Decimal("50.00"))
    assert resp.balance == Decimal("50.00")  # spendable, unchanged by the hold
    assert resp.reserved == Decimal("50.00")  # held separately


def test_response_defaults_reserved_to_zero():
    row = _Row(card_id=2, balance="100.00")
    resp = _to_response(row)
    assert resp.reserved == Decimal("0.00")
