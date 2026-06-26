from decimal import Decimal


def _amount(value: Decimal | str) -> str:
    return f"${Decimal(str(value)):,.2f}"


def _greeting(first_name: str | None) -> str:
    if first_name and first_name.strip():
        return f"Hi {first_name.strip()},"
    return "Hi,"


def payment_sent(*, first_name: str | None, amount: Decimal, transaction_id: int) -> tuple[str, str]:
    subject = f"Payment sent — {_amount(amount)}"
    body = (
        f"{_greeting(first_name)}\n\n"
        f"Your payment of {_amount(amount)} has been completed.\n"
        f"Transaction #{transaction_id}\n\n"
        "You can view details in Heap under Transactions.\n\n"
        "— Heap"
    )
    return subject, body


def payment_received(
    *, first_name: str | None, amount: Decimal, transaction_id: int
) -> tuple[str, str]:
    subject = f"Payment received — {_amount(amount)}"
    body = (
        f"{_greeting(first_name)}\n\n"
        f"You received {_amount(amount)}.\n"
        f"Transaction #{transaction_id}\n\n"
        "You can view details in Heap under Transactions.\n\n"
        "— Heap"
    )
    return subject, body


def topup_completed(
    *, first_name: str | None, amount: Decimal, transaction_id: int
) -> tuple[str, str]:
    subject = f"Top-up complete — {_amount(amount)}"
    body = (
        f"{_greeting(first_name)}\n\n"
        f"Your card was topped up with {_amount(amount)}.\n"
        f"Transaction #{transaction_id}\n\n"
        "You can view details in Heap under Wallet.\n\n"
        "— Heap"
    )
    return subject, body


def refund_approved(
    *,
    first_name: str | None,
    amount: Decimal | None,
    request_id: int,
    transaction_id: int | None,
) -> tuple[str, str]:
    amount_line = f"Amount: {_amount(amount)}\n" if amount is not None else ""
    tx_line = f"Original transaction #{transaction_id}\n" if transaction_id else ""
    subject = "Refund request approved"
    body = (
        f"{_greeting(first_name)}\n\n"
        "Your refund request has been approved.\n"
        f"Request #{request_id}\n"
        f"{tx_line}"
        f"{amount_line}\n"
        "Funds will appear on your card per the refund policy.\n\n"
        "— Heap"
    )
    return subject, body


def refund_declined(
    *,
    first_name: str | None,
    request_id: int,
    transaction_id: int | None,
) -> tuple[str, str]:
    tx_line = f"Original transaction #{transaction_id}\n" if transaction_id else ""
    subject = "Refund request declined"
    body = (
        f"{_greeting(first_name)}\n\n"
        "Your refund request was declined.\n"
        f"Request #{request_id}\n"
        f"{tx_line}\n"
        "Open Heap for more details or contact support if you have questions.\n\n"
        "— Heap"
    )
    return subject, body
