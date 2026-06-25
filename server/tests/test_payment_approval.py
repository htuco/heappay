"""Tests for in-app payment approval (step-up, timeout, audit)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from services.transaction.transaction_processor import (
    APPROVAL_TIMEOUT,
    AWAITING_USER_APPROVAL,
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
        tx_user_approval_above_amount=Decimal("100"),
        tx_user_approval_timeout_minutes=15,
        tx_user_approval_type_names="fine",
    )
    base.update(overrides)
    return Settings(**base)


def _active_card(*, user_id: int):
    card = MagicMock(deleted_at=None, user_id=user_id)
    card.expires_at = datetime(2030, 12, 31).date()
    card.status.status_name = "active"
    user = MagicMock(deleted_at=None)
    user.status.status_name = "active"
    card.user = user
    return card


def _tx(**kwargs):
    defaults = dict(
        amount=Decimal("50.00"),
        sender_card_id=10,
        sender_card=_active_card(user_id=1),
        recipient_card=_active_card(user_id=2),
        created_at=datetime.now(timezone.utc),
        requires_user_approval=True,
        user_approved_at=None,
        user_approval_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    defaults.update(kwargs)
    tx = MagicMock()
    for key, value in defaults.items():
        setattr(tx, key, value)
    return tx


def test_skip_when_awaiting_user_approval():
    decision = evaluate_transaction(_tx(), _settings())
    assert decision.action == "skip"
    assert decision.reason_code == AWAITING_USER_APPROVAL


def test_allow_after_user_approved():
    decision = evaluate_transaction(
        _tx(user_approved_at=datetime.now(timezone.utc)),
        _settings(),
    )
    assert decision.action == "allow"


def test_deny_when_approval_window_expired():
    decision = evaluate_transaction(
        _tx(
            user_approval_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        ),
        _settings(),
    )
    assert decision.action == "deny"
    assert decision.reason_code == APPROVAL_TIMEOUT


def test_fine_type_triggers_approval_via_service_helper():
    from schemas.transaction import TransactionCreate
    from services.transaction.transaction import TransactionService

    repo = MagicMock()
    service = TransactionService(repo)
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=6,
        amount=Decimal("10.00"),
    )
    assert service._requires_user_approval(payload, "fine") is True


def test_amount_threshold_triggers_approval():
    from schemas.transaction import TransactionCreate
    from services.transaction.transaction import TransactionService

    service = TransactionService(MagicMock())
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("150.00"),
    )
    assert service._requires_user_approval(payload, "payment") is True

    small = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("25.00"),
    )
    assert service._requires_user_approval(small, "payment") is False
