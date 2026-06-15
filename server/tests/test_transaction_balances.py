"""Unit tests for escrow create / complete / fail balance effects."""

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from repositories.transaction.transaction import TransactionRepository, TransactionStateError
from services.card.card import CardHasPendingTransactionsError, CardService


class _FakeCard:
    def __init__(self, card_id: int, balance: str = "100.00", user_id: int = 1):
        self.card_id = card_id
        self.user_id = user_id
        self.balance = Decimal(balance)
        self.deleted_at: datetime | None = None
        self.expires_at = date(2030, 12, 31)
        self.is_main = card_id == 1


class _FakeTx:
    def __init__(
        self,
        tx_id: int,
        *,
        sender_id: int | None,
        recipient_id: int,
        amount: str,
        status_id: int = 1,
    ):
        self.transaction_id = tx_id
        self.sender_card_id = sender_id
        self.recipient_card_id = recipient_id
        self.amount = Decimal(amount)
        self.status_id = status_id
        self.processing_eligible_at = datetime.now(timezone.utc)
        self.processed_at = None
        self.processed_by = None
        self.deny_reason_code = None


class FakeTransactionRepository(TransactionRepository):
    """Minimal in-memory repo for balance transition tests."""

    def __init__(self) -> None:
        self._cards: dict[int, _FakeCard] = {
            1: _FakeCard(1, "100.00", user_id=1),
            2: _FakeCard(2, "50.00", user_id=2),
        }
        self._txs: dict[int, _FakeTx] = {}
        self._next_id = 1
        self._pending_id = 1
        self._completed_id = 2
        self._failed_id = 3
        self._cancelled_id = 5

    def get_status_id_by_name(self, name: str) -> int | None:
        return {"pending": 1, "completed": 2, "failed": 3, "cancelled": 5}.get(name)

    def get_card_for_update(self, card_id: int):
        return self._cards.get(card_id)

    def create_with_balance_update(self, *, sender_card, recipient_card, amount, **kwargs):
        if sender_card is not None:
            sender_card.balance -= amount
        tx = _FakeTx(
            self._next_id,
            sender_id=sender_card.card_id if sender_card else None,
            recipient_id=recipient_card.card_id,
            amount=str(amount),
        )
        self._txs[tx.transaction_id] = tx
        self._next_id += 1
        return tx

    def _get_transaction_for_update(self, transaction_id: int):
        return self._txs.get(transaction_id)

    def complete(self, transaction_id: int, *, processed_by: str):
        tx = self._txs[transaction_id]
        if tx.status_id != self._pending_id:
            raise TransactionStateError("not pending")
        recipient = self._cards[tx.recipient_card_id]
        recipient.balance += tx.amount
        tx.status_id = self._completed_id
        tx.processed_by = processed_by
        return tx

    def fail(self, transaction_id: int, *, reason_code: str, processed_by: str):
        tx = self._txs[transaction_id]
        if tx.status_id != self._pending_id:
            raise TransactionStateError("not pending")
        if tx.sender_card_id is not None:
            self._cards[tx.sender_card_id].balance += tx.amount
        tx.status_id = self._failed_id
        tx.deny_reason_code = reason_code
        tx.processed_by = processed_by
        return tx

    def cancel(self, transaction_id: int, *, reason_code: str, processed_by: str):
        tx = self._txs[transaction_id]
        if tx.status_id != self._pending_id:
            raise TransactionStateError("not pending")
        if tx.sender_card_id is not None:
            self._cards[tx.sender_card_id].balance += tx.amount
        tx.status_id = self._cancelled_id
        tx.deny_reason_code = reason_code
        tx.processed_by = processed_by
        return tx


def test_escrow_create_holds_sender_only():
    repo = FakeTransactionRepository()
    sender = repo.get_card_for_update(1)
    recipient = repo.get_card_for_update(2)
    repo.create_with_balance_update(
        sender_card=sender,
        recipient_card=recipient,
        transaction_type_id=2,
        status_id=1,
        amount=Decimal("30.00"),
        note=None,
        processing_eligible_at=datetime.now(timezone.utc),
    )
    assert sender.balance == Decimal("70.00")
    assert recipient.balance == Decimal("50.00")


def test_complete_credits_recipient():
    repo = FakeTransactionRepository()
    sender = repo.get_card_for_update(1)
    recipient = repo.get_card_for_update(2)
    tx = repo.create_with_balance_update(
        sender_card=sender,
        recipient_card=recipient,
        transaction_type_id=2,
        status_id=1,
        amount=Decimal("30.00"),
        note=None,
        processing_eligible_at=datetime.now(timezone.utc),
    )
    repo.complete(tx.transaction_id, processed_by="system")
    assert sender.balance == Decimal("70.00")
    assert recipient.balance == Decimal("80.00")


def test_fail_restores_sender():
    repo = FakeTransactionRepository()
    sender = repo.get_card_for_update(1)
    recipient = repo.get_card_for_update(2)
    tx = repo.create_with_balance_update(
        sender_card=sender,
        recipient_card=recipient,
        transaction_type_id=2,
        status_id=1,
        amount=Decimal("30.00"),
        note=None,
        processing_eligible_at=datetime.now(timezone.utc),
    )
    repo.fail(tx.transaction_id, reason_code="TEST", processed_by="system")
    assert sender.balance == Decimal("100.00")
    assert recipient.balance == Decimal("50.00")


def test_cancel_restores_sender_and_sets_cancelled():
    repo = FakeTransactionRepository()
    sender = repo.get_card_for_update(1)
    recipient = repo.get_card_for_update(2)
    tx = repo.create_with_balance_update(
        sender_card=sender,
        recipient_card=recipient,
        transaction_type_id=2,
        status_id=1,
        amount=Decimal("30.00"),
        note=None,
        processing_eligible_at=datetime.now(timezone.utc),
    )
    cancelled = repo.cancel(
        tx.transaction_id, reason_code="USER_CANCELLED", processed_by="user"
    )
    # Held funds released to the sender; recipient never credited.
    assert sender.balance == Decimal("100.00")
    assert recipient.balance == Decimal("50.00")
    # Distinct status, distinct reason — not failed.
    assert cancelled.status_id == 5
    assert cancelled.deny_reason_code == "USER_CANCELLED"


class FakeCardRepo:
    def __init__(self, cards: list[_FakeCard], pending_ids: set[int] | None = None):
        self._cards = {c.card_id: c for c in cards}
        self._pending = pending_ids or set()

    def list_expired_for_soft_delete(self, *, limit: int):
        today = datetime.now(timezone.utc).date()
        return [
            c
            for c in self._cards.values()
            if c.deleted_at is None and c.expires_at < today
        ][:limit]

    def get_by_id(self, card_id: int, *, include_deleted: bool = False):
        c = self._cards.get(card_id)
        if c is None or (c.deleted_at and not include_deleted):
            return None
        return c

    def get_by_id_for_update(self, card_id: int):
        return self.get_by_id(card_id)

    def get_main_card(self, user_id: int):
        for c in self._cards.values():
            if (
                c.user_id == user_id
                and c.is_main
                and c.deleted_at is None
            ):
                return c
        return None

    def get_oldest_active_card_for_user(self, user_id: int, *, exclude_card_id: int):
        others = [
            c
            for c in self._cards.values()
            if c.user_id == user_id
            and c.card_id != exclude_card_id
            and c.deleted_at is None
        ]
        return sorted(others, key=lambda c: c.card_id)[0] if others else None

    def transfer_balance(self, *, from_card_id: int, to_card_id: int, amount):
        self._cards[from_card_id].balance -= amount
        self._cards[to_card_id].balance += amount

    def create_completed_sweep_transaction(self, **kwargs):
        return None

    def has_pending_transactions(self, card_id: int) -> bool:
        return card_id in self._pending

    def soft_delete(self, row) -> None:
        row.deleted_at = datetime.now(timezone.utc)

    def _promote_next_main_card(self, user_id: int) -> None:
        for c in self._cards.values():
            if c.user_id == user_id and c.deleted_at is None:
                c.is_main = True
                return


def test_expire_overdue_cards_soft_deletes_when_no_pending():
    expired = _FakeCard(5, balance="0.00", user_id=9)
    expired.expires_at = date(2020, 1, 1)
    repo = FakeCardRepo([expired])
    service = CardService(repo)  # type: ignore[arg-type]
    stats = service.expire_overdue_cards(limit=10)
    assert stats["cards_expired"] == 1
    assert expired.deleted_at is not None


def test_expire_overdue_cards_skips_pending():
    expired = _FakeCard(5, user_id=9)
    expired.expires_at = date(2020, 1, 1)
    repo = FakeCardRepo([expired], pending_ids={5})
    service = CardService(repo)  # type: ignore[arg-type]
    stats = service.expire_overdue_cards(limit=10)
    assert stats["cards_skipped_pending"] == 1
    assert expired.deleted_at is None


def test_expire_sweeps_balance_to_main_card():
    main = _FakeCard(1, balance="200.00", user_id=9)
    main.is_main = True
    expired = _FakeCard(2, balance="75.50", user_id=9)
    expired.is_main = False
    expired.expires_at = date(2020, 1, 1)
    repo = FakeCardRepo([main, expired])
    service = CardService(repo)  # type: ignore[arg-type]
    stats = service.expire_overdue_cards(limit=10)
    assert stats["cards_expired"] == 1
    assert expired.deleted_at is not None
    assert expired.balance == Decimal("0.00")
    assert main.balance == Decimal("275.50")


def test_expire_main_card_sweeps_to_other_card():
    expiring_main = _FakeCard(1, balance="40.00", user_id=9)
    expiring_main.is_main = True
    expiring_main.expires_at = date(2020, 1, 1)
    other = _FakeCard(2, balance="10.00", user_id=9)
    other.is_main = False
    repo = FakeCardRepo([expiring_main, other])
    service = CardService(repo)  # type: ignore[arg-type]
    service.expire_overdue_cards(limit=10)
    assert expiring_main.deleted_at is not None
    assert other.balance == Decimal("50.00")
    assert other.is_main is True


def test_manual_delete_sweeps_balance_to_main_card():
    main = _FakeCard(1, balance="200.00", user_id=9)
    main.is_main = True
    other = _FakeCard(2, balance="30.00", user_id=9)
    other.is_main = False
    repo = FakeCardRepo([main, other])
    service = CardService(repo)  # type: ignore[arg-type]
    service.delete(2)
    assert other.deleted_at is not None
    assert main.balance == Decimal("230.00")


def test_expire_skips_when_only_card_has_balance():
    only = _FakeCard(1, balance="25.00", user_id=9)
    only.is_main = True
    only.expires_at = date(2020, 1, 1)
    repo = FakeCardRepo([only])
    service = CardService(repo)  # type: ignore[arg-type]
    stats = service.expire_overdue_cards(limit=10)
    assert stats["cards_skipped_no_destination"] == 1
    assert only.deleted_at is None
