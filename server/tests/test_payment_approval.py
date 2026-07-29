"""Tests for in-app payment approval (step-up, timeout, audit)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import bcrypt
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
        # None means "pre-approver-column row" -- falls back to the sender-owner
        # check, same as every real row created before this column existed.
        approver_user_id=None,
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


def test_begin_biometric_transaction_verification_creates_account_challenge(monkeypatch):
    from services.transaction import transaction as transaction_module
    from services.transaction.transaction import TransactionService

    repo = MagicMock()
    credential = MagicMock(credential_id="Y3JlZGVudGlhbC1pZA")
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = [credential]
    auth_repo.create_biometric_authentication_challenge.return_value = MagicMock(
        challenge_id=6,
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
    response = service.begin_biometric_transaction_verification(user_id=1)

    assert response.challenge_id == 6
    kwargs = auth_repo.create_biometric_authentication_challenge.call_args.kwargs
    assert kwargs["user_id"] == 1
    assert kwargs["transaction_id"] is None
    assert kwargs["challenge"] == "Y2hhbGxlbmdlLWJ5dGVz"


def test_create_requires_biometric_or_pin_when_user_has_enrolled_credential():
    from schemas.transaction import TransactionCreate
    from services.transaction.transaction import ApprovalRequiredError, TransactionService

    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = [MagicMock()]
    auth_repo.get_user_by_id.return_value = MagicMock(deleted_at=None, app_pin_hash=None)
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("25.00"),
    )

    service = TransactionService(MagicMock(), auth_repo=auth_repo)

    with pytest.raises(ApprovalRequiredError, match="Biometric verification or app PIN"):
        service._verify_transaction_create_confirmation(1, payload)


def test_create_accepts_biometric_when_user_has_enrolled_credential(monkeypatch):
    from schemas.transaction import TransactionCreate
    from services.transaction import transaction as transaction_module
    from services.transaction.transaction import TransactionService

    credential = MagicMock(
        credential_row_id=12,
        credential_id="Y3JlZGVudGlhbC1pZA",
        public_key=b"public-key",
        sign_count=1,
    )
    challenge = MagicMock(
        challenge_id=6,
        challenge="Y2hhbGxlbmdlLWJ5dGVz",
        used_at=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = [credential]
    auth_repo.get_biometric_credential.return_value = credential
    auth_repo.get_biometric_authentication_challenge.return_value = challenge
    monkeypatch.setattr(
        transaction_module,
        "verify_authentication_response",
        lambda **_: MagicMock(new_sign_count=2),
    )
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("25.00"),
        biometric={
            "challenge_id": 6,
            "credential": {
                "id": "Y3JlZGVudGlhbC1pZA",
                "rawId": "Y3JlZGVudGlhbC1pZA",
                "type": "public-key",
                "response": {},
            },
        },
    )

    service = TransactionService(MagicMock(), auth_repo=auth_repo)
    service._verify_transaction_create_confirmation(1, payload)

    auth_repo.get_biometric_authentication_challenge.assert_called_once_with(
        user_id=1,
        transaction_id=None,
        challenge_id=6,
    )
    auth_repo.mark_biometric_authentication_challenge_used.assert_called_once_with(6)


def test_create_allows_without_pin_when_biometrics_pin_and_policy_are_not_enabled():
    from schemas.transaction import TransactionCreate
    from services.transaction.transaction import TransactionService

    user = MagicMock(
        deleted_at=None,
        app_pin_hash=None,
        payment_confirm_enabled=False,
        payment_confirm_above_amount=Decimal("0"),
    )
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = []
    auth_repo.get_user_by_id.return_value = user
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("25.00"),
    )

    service = TransactionService(MagicMock(), auth_repo=auth_repo)
    service._verify_transaction_create_confirmation(1, payload)


def test_create_requires_password_when_policy_always_confirm():
    from schemas.transaction import TransactionCreate
    from services.transaction.transaction import ApprovalRequiredError, TransactionService

    user = MagicMock(
        deleted_at=None,
        app_pin_hash=None,
        totp_enabled=False,
        payment_confirm_enabled=True,
        payment_confirm_above_amount=Decimal("0"),
    )
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = []
    auth_repo.get_user_by_id.return_value = user
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("80.00"),
    )

    service = TransactionService(MagicMock(), auth_repo=auth_repo)

    with pytest.raises(ApprovalRequiredError, match="Password is required"):
        service._verify_transaction_create_confirmation(1, payload)


def test_create_accepts_password_when_policy_requires_confirmation():
    from schemas.transaction import TransactionCreate
    from services.transaction.transaction import TransactionService

    user = MagicMock(
        deleted_at=None,
        app_pin_hash=None,
        totp_enabled=False,
        password_hash=bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode("utf-8"),
        payment_confirm_enabled=True,
        payment_confirm_above_amount=Decimal("0"),
    )
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = []
    auth_repo.get_user_by_id.return_value = user
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("80.00"),
        password="secret",
    )

    service = TransactionService(MagicMock(), auth_repo=auth_repo)
    service._verify_transaction_create_confirmation(1, payload)


def test_create_skips_policy_when_amount_below_threshold():
    from schemas.transaction import TransactionCreate
    from services.transaction.transaction import TransactionService

    user = MagicMock(
        deleted_at=None,
        app_pin_hash=None,
        totp_enabled=False,
        payment_confirm_enabled=True,
        payment_confirm_above_amount=Decimal("100.00"),
    )
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = []
    auth_repo.get_user_by_id.return_value = user
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("80.00"),
    )

    service = TransactionService(MagicMock(), auth_repo=auth_repo)
    service._verify_transaction_create_confirmation(1, payload)


def test_create_requires_app_pin_when_pin_is_enabled_and_biometrics_are_not_enabled():
    from schemas.transaction import TransactionCreate
    from services.transaction.transaction import ApprovalRequiredError, TransactionService

    user = MagicMock(deleted_at=None, app_pin_hash="pin-hash")
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = []
    auth_repo.get_user_by_id.return_value = user
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("25.00"),
    )

    service = TransactionService(MagicMock(), auth_repo=auth_repo)

    with pytest.raises(ApprovalRequiredError, match="App PIN is required"):
        service._verify_transaction_create_confirmation(1, payload)


def test_create_accepts_app_pin_when_biometrics_are_not_enabled(monkeypatch):
    from schemas.transaction import TransactionCreate
    from services.transaction import transaction as transaction_module
    from services.transaction.transaction import TransactionService

    user = MagicMock(
        deleted_at=None,
        app_pin_hash="pin-hash",
        app_pin_failed_attempts=1,
        app_pin_locked_until=None,
    )
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = []
    auth_repo.get_user_by_id.return_value = user
    monkeypatch.setattr(transaction_module.bcrypt, "checkpw", lambda *_: True)
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("25.00"),
        app_pin="1234",
    )

    service = TransactionService(MagicMock(), auth_repo=auth_repo)
    service._verify_transaction_create_confirmation(1, payload)

    auth_repo.reset_app_pin_failures.assert_called_once_with(1)


def test_create_locks_app_pin_after_failed_attempts(monkeypatch):
    from schemas.transaction import TransactionCreate
    from services.transaction import transaction as transaction_module
    from services.transaction.transaction import ApprovalRequiredError, TransactionService

    user = MagicMock(
        deleted_at=None,
        app_pin_hash="pin-hash",
        app_pin_failed_attempts=4,
        app_pin_locked_until=None,
    )
    auth_repo = MagicMock()
    auth_repo.list_biometric_credentials.return_value = []
    auth_repo.get_user_by_id.return_value = user
    monkeypatch.setattr(transaction_module.bcrypt, "checkpw", lambda *_: False)
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=2,
        amount=Decimal("25.00"),
        app_pin="0000",
    )

    service = TransactionService(MagicMock(), auth_repo=auth_repo)

    with pytest.raises(ApprovalRequiredError, match="App PIN is locked"):
        service._verify_transaction_create_confirmation(1, payload)

    kwargs = auth_repo.record_app_pin_failure.call_args.kwargs
    assert kwargs["failed_attempts"] == 5
    assert kwargs["locked_until"] is not None


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


def test_approve_accepts_app_pin(monkeypatch):
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
    user = MagicMock(
        deleted_at=None,
        totp_enabled=False,
        app_pin_hash="pin-hash",
        app_pin_failed_attempts=0,
        app_pin_locked_until=None,
    )
    auth_repo = MagicMock()
    auth_repo.get_user_by_id.return_value = user
    monkeypatch.setattr(transaction_module.bcrypt, "checkpw", lambda *_: True)

    payload = TransactionApproveRequest(app_pin="1234")
    service = TransactionService(repo, approval_repo=approval_repo, auth_repo=auth_repo)
    result = service.approve(99, payload, user_id=1)

    assert result is approved
    repo.approve_user_confirmation.assert_called_once_with(99, approval_method="app_pin")
    auth_repo.reset_app_pin_failures.assert_called_once_with(1)
    approval_repo.record_event.assert_called_once()
