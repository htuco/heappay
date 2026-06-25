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


def test_begin_biometric_approval_creates_transaction_challenge(monkeypatch):
    from services.transaction import transaction as transaction_module
    from services.transaction.transaction import TransactionService

    tx = _tx(transaction_id=99)
    repo = MagicMock()
    repo.get_by_id.return_value = tx
    repo.card_owner_id.return_value = 1
    credential = MagicMock(credential_id="Y3JlZGVudGlhbC1pZA")
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = [credential]
    auth_repo.create_biometric_authentication_challenge.return_value = MagicMock(
        challenge_id=5,
    )
    monkeypatch.setattr(
        transaction_module,
        "generate_authentication_options",
        lambda **_: MagicMock(challenge=b"challenge-bytes"),
    )
    monkeypatch.setattr(
        transaction_module,
        "options_to_json",
        lambda _: '{"challenge":"challenge-bytes","allowCredentials":[]}',
    )

    service = TransactionService(repo, auth_repo=auth_repo)
    response = service.begin_biometric_approval(99, user_id=1)

    assert response.challenge_id == 5
    assert response.public_key["challenge"] == "challenge-bytes"
    auth_repo.create_biometric_authentication_challenge.assert_called_once()
    kwargs = auth_repo.create_biometric_authentication_challenge.call_args.kwargs
    assert kwargs["user_id"] == 1
    assert kwargs["transaction_id"] == 99
    assert kwargs["challenge"] == "Y2hhbGxlbmdlLWJ5dGVz"


def test_approve_accepts_biometric_assertion(monkeypatch):
    from schemas.transaction import TransactionApproveRequest
    from services.transaction import transaction as transaction_module
    from services.transaction.transaction import TransactionService

    tx = _tx(transaction_id=99)
    approved = _tx(transaction_id=99, user_approved_at=datetime.now(timezone.utc))
    repo = MagicMock()
    repo._db = MagicMock()
    repo.get_by_id.return_value = tx
    repo.card_owner_id.return_value = 1
    repo.approve_user_confirmation.return_value = approved
    approval_repo = MagicMock()

    credential = MagicMock(
        credential_row_id=12,
        credential_id="Y3JlZGVudGlhbC1pZA",
        public_key=b"public-key",
        sign_count=1,
    )
    challenge = MagicMock(
        challenge_id=5,
        challenge="Y2hhbGxlbmdlLWJ5dGVz",
        used_at=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    user = MagicMock(deleted_at=None, totp_enabled=False)
    auth_repo = MagicMock()
    auth_repo.get_user_by_id.return_value = user
    auth_repo.get_biometric_credential.return_value = credential
    auth_repo.get_biometric_authentication_challenge.return_value = challenge
    monkeypatch.setattr(
        transaction_module,
        "verify_authentication_response",
        lambda **_: MagicMock(new_sign_count=2),
    )

    payload = TransactionApproveRequest(
        biometric={
            "challenge_id": 5,
            "credential": {
                "id": "Y3JlZGVudGlhbC1pZA",
                "rawId": "Y3JlZGVudGlhbC1pZA",
                "type": "public-key",
                "response": {},
            },
        },
    )
    service = TransactionService(repo, approval_repo=approval_repo, auth_repo=auth_repo)

    result = service.approve(99, payload, user_id=1)

    assert result is approved
    repo.approve_user_confirmation.assert_called_once_with(99, approval_method="biometric")
    auth_repo.mark_biometric_authentication_challenge_used.assert_called_once_with(5)
    auth_repo.update_biometric_credential_usage.assert_called_once_with(
        credential_row_id=12,
        sign_count=2,
    )
    approval_repo.record_event.assert_called_once()
