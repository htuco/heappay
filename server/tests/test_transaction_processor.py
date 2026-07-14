"""Unit tests for transaction processor rules and card expiry checks."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from services.transaction.transaction_processor import (
    AUTO_ALLOW,
    RECIPIENT_CARD_EXPIRED,
    SENDER_CARD_EXPIRED,
    SELF_TRANSFER,
    evaluate_transaction,
)
from settings import Settings


def _settings(**overrides) -> Settings:
    base = dict(
        host="x",
        port=8000,
        reload=False,
        database_url="x",
        cors_origins="x",
        secret_key="x",
        tx_manual_review_above_amount=Decimal("500000"),
        tx_pending_max_age_minutes=1440,
        tx_pending_timeout_action="deny",
    )
    base.update(overrides)
    return Settings(**base)


def _active_card(*, user_id: int, expires_at: date | None = None):
    card = MagicMock(deleted_at=None, user_id=user_id)
    card.expires_at = expires_at or date(2030, 12, 31)
    card.status.status_name = "active"
    user = MagicMock(deleted_at=None)
    user.status.status_name = "active"
    card.user = user
    return card


def _tx(
    *,
    amount: str = "100.00",
    sender_user_id: int = 1,
    recipient_user_id: int = 2,
    sender_expires: date | None = None,
    recipient_expires: date | None = None,
    created_at: datetime | None = None,
):
    tx = MagicMock()
    tx.amount = Decimal(amount)
    tx.sender_card_id = 10
    tx.sender_card = _active_card(user_id=sender_user_id, expires_at=sender_expires)
    tx.recipient_card = _active_card(
        user_id=recipient_user_id, expires_at=recipient_expires
    )
    tx.created_at = created_at or datetime.now(timezone.utc)
    return tx


def test_auto_allow_under_manual_review_threshold():
    decision = evaluate_transaction(_tx(amount="1000.00"), _settings())
    assert decision.action == "allow"
    assert decision.reason_code == AUTO_ALLOW


def test_skip_above_manual_review_threshold():
    decision = evaluate_transaction(_tx(amount="500001.00"), _settings())
    assert decision.action == "skip"
    assert decision.reason_code == "MANUAL_REVIEW"


def test_deny_self_transfer():
    decision = evaluate_transaction(_tx(sender_user_id=5, recipient_user_id=5), _settings())
    assert decision.action == "deny"
    assert decision.reason_code == SELF_TRANSFER


def test_deny_expired_sender_card():
    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    decision = evaluate_transaction(_tx(sender_expires=yesterday), _settings())
    assert decision.action == "deny"
    assert decision.reason_code == SENDER_CARD_EXPIRED


def test_deny_expired_recipient_card():
    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    decision = evaluate_transaction(_tx(recipient_expires=yesterday), _settings())
    assert decision.action == "deny"
    assert decision.reason_code == RECIPIENT_CARD_EXPIRED


def test_pending_timeout_denies():
    old = datetime.now(timezone.utc) - timedelta(days=2)
    decision = evaluate_transaction(
        _tx(created_at=old),
        _settings(tx_pending_max_age_minutes=60),
    )
    assert decision.action == "deny"


def test_deposit_without_sender_skips_self_transfer_check():
    tx = _tx()
    tx.sender_card_id = None
    tx.sender_card = None
    decision = evaluate_transaction(tx, _settings())
    assert decision.action == "allow"
