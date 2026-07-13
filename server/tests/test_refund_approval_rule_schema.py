"""Validation tests for the admin-editable refund approval rule payload."""

import os

import pytest
from pydantic import ValidationError

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from schemas.refund_approval_rule import RefundApprovalRuleUpdate  # noqa: E402


def test_accepts_valid_payload():
    payload = RefundApprovalRuleUpdate(enabled=True, auto_approve_max_amount="25.00", max_age_days=7)
    assert payload.max_age_days == 7


def test_rejects_negative_amount():
    with pytest.raises(ValidationError):
        RefundApprovalRuleUpdate(enabled=True, auto_approve_max_amount="-1.00", max_age_days=7)


def test_rejects_zero_age():
    with pytest.raises(ValidationError):
        RefundApprovalRuleUpdate(enabled=True, auto_approve_max_amount="25.00", max_age_days=0)


def test_rejects_age_over_one_year():
    with pytest.raises(ValidationError):
        RefundApprovalRuleUpdate(enabled=True, auto_approve_max_amount="25.00", max_age_days=366)
