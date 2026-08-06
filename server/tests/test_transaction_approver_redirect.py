"""`_user_is_approver` tests: approver_user_id (set at create time, defaulting
to the payer, redirected to a guardian for a dependent under a spending-limit
rule) must gate approve()/begin_biometric_approval() correctly, and fall back
to the pre-migration sender-owner check for rows where the column is NULL.
"""
from types import SimpleNamespace

from services.transaction.transaction import TransactionService


def _service():
    return TransactionService(SimpleNamespace(_db=None, card_owner_id=lambda card_id: {10: 1}.get(card_id)))


def _row(*, sender_card_id=10, approver_user_id=None):
    return SimpleNamespace(sender_card_id=sender_card_id, approver_user_id=approver_user_id)


def test_approver_set_uses_approver_column_not_sender() -> None:
    svc = _service()
    row = _row(approver_user_id=5)
    # user_id 1 is the card owner (sender) per the fake card_owner_id map, but
    # approver_user_id (5) is what must gate approval once it's set.
    assert svc._user_is_approver(row, 5) is True
    assert svc._user_is_approver(row, 1) is False


def test_approver_null_falls_back_to_sender_check() -> None:
    svc = _service()
    row = _row(approver_user_id=None)
    assert svc._user_is_approver(row, 1) is True
    assert svc._user_is_approver(row, 5) is False


def test_non_family_transaction_approver_defaults_to_payer() -> None:
    # This is the shape create() produces for every non-family transaction:
    # approver_user_id == the payer's own id, so _user_is_approver reduces to
    # exactly the old sender-owner check -- no behavior change for these rows.
    svc = _service()
    row = _row(approver_user_id=1)
    assert svc._user_is_approver(row, 1) is True
    assert svc._user_is_approver(row, 2) is False
