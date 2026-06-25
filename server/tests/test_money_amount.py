from decimal import Decimal

import os

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402
from routes.dependencies import get_current_user_id  # noqa: E402
from routes.transaction.transaction import get_transaction_service  # noqa: E402
from schemas.nexus import FundRequestCreate  # noqa: E402
from schemas.transaction import TransactionCreate  # noqa: E402
from tests.test_transaction_idempotency import FakeTransactionService  # noqa: E402
from utils.money import InvalidMoneyAmountError, parse_money_amount  # noqa: E402


def test_parse_money_amount_normalizes_single_decimal_place() -> None:
    assert parse_money_amount("30.3") == Decimal("30.30")


def test_parse_money_amount_normalizes_integer_string() -> None:
    assert parse_money_amount("10") == Decimal("10.00")


def test_parse_money_amount_accepts_two_decimal_places() -> None:
    assert parse_money_amount("10.99") == Decimal("10.99")


def test_parse_money_amount_rejects_more_than_two_decimal_places() -> None:
    with pytest.raises(InvalidMoneyAmountError, match="at most 2 decimal places"):
        parse_money_amount("10.999")


def test_parse_money_amount_rejects_zero() -> None:
    with pytest.raises(InvalidMoneyAmountError, match="greater than zero"):
        parse_money_amount("0")


def test_parse_money_amount_rejects_negative() -> None:
    with pytest.raises(InvalidMoneyAmountError):
        parse_money_amount("-5.00")


def test_parse_money_amount_rejects_garbage() -> None:
    with pytest.raises(InvalidMoneyAmountError):
        parse_money_amount("abc")


def test_transaction_create_schema_normalizes_amount() -> None:
    payload = TransactionCreate(
        sender_card_id=1,
        recipient_card_id=2,
        transaction_type_id=1,
        amount="30.3",
    )
    assert payload.amount == Decimal("30.30")


def test_transaction_create_schema_rejects_extra_decimals() -> None:
    with pytest.raises(ValidationError) as exc:
        TransactionCreate(
            sender_card_id=1,
            recipient_card_id=2,
            transaction_type_id=1,
            amount="10.999",
        )
    assert any(err["loc"] == ("amount",) for err in exc.value.errors())


def test_nexus_fund_request_schema_normalizes_amount() -> None:
    payload = FundRequestCreate(amount="25.5")
    assert payload.amount == Decimal("25.50")


def test_post_transactions_rejects_more_than_two_decimal_places() -> None:
    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: FakeTransactionService()
    app.dependency_overrides[get_current_user_id] = lambda: 1
    client = TestClient(app)

    response = client.post(
        "/transactions",
        json={
            "sender_card_id": 1,
            "recipient_card_id": 2,
            "transaction_type_id": 1,
            "amount": "10.999",
        },
    )

    assert response.status_code == 422


def test_post_transactions_accepts_normalized_single_decimal_place() -> None:
    captured: dict[str, Decimal] = {}

    class _CapturingFake(FakeTransactionService):
        def create(self, payload: TransactionCreate, *, user_id: int):
            captured["amount"] = payload.amount
            return super().create(payload, user_id=user_id)

    app = create_app()
    app.dependency_overrides[get_transaction_service] = _CapturingFake
    app.dependency_overrides[get_current_user_id] = lambda: 1
    client = TestClient(app)

    response = client.post(
        "/transactions",
        json={
            "sender_card_id": 1,
            "recipient_card_id": 2,
            "transaction_type_id": 1,
            "amount": "30.3",
            "idempotency_key": "amount-normalize",
        },
    )

    assert response.status_code == 201
    assert captured["amount"] == Decimal("30.30")
