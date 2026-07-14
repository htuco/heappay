"""Email templates for admin notifications about user-submitted requests."""
from decimal import Decimal


def _amount(value: Decimal | str | None) -> str:
    if value is None:
        return "n/a"
    return f"${Decimal(str(value)):,.2f}"


def _requester(name: str | None, user_id: int | None) -> str:
    if name and name.strip():
        return f"{name.strip()} (user #{user_id})" if user_id else name.strip()
    return f"user #{user_id}" if user_id else "a user"


def refund_requested(
    *,
    requester_name: str | None,
    requester_user_id: int | None,
    request_id: int,
    transaction_id: int | None,
    amount: Decimal | None,
    note: str | None,
) -> tuple[str, str]:
    tx_line = f"Original transaction: #{transaction_id}\n" if transaction_id else ""
    note_line = f"Note: {note}\n" if note else ""
    subject = f"[Heap] New refund request #{request_id}"
    body = (
        "A user submitted a refund request that needs review.\n\n"
        f"Requested by: {_requester(requester_name, requester_user_id)}\n"
        f"Request: #{request_id}\n"
        f"{tx_line}"
        f"Amount: {_amount(amount)}\n"
        f"{note_line}\n"
        "Review it in Heap under Admin → Requests.\n\n"
        "— Heap"
    )
    return subject, body


def card_action_requested(
    *,
    action: str,
    requester_name: str | None,
    requester_user_id: int | None,
    request_id: int,
    card_last_four: str | None,
    note: str | None,
) -> tuple[str, str]:
    label = "freeze" if action == "card_freeze" else "unfreeze"
    card_line = f"Card: •••• {card_last_four}\n" if card_last_four else ""
    note_line = f"Note: {note}\n" if note else ""
    subject = f"[Heap] New card {label} request #{request_id}"
    body = (
        f"A user submitted a card {label} request that needs review.\n\n"
        f"Requested by: {_requester(requester_name, requester_user_id)}\n"
        f"Request: #{request_id}\n"
        f"{card_line}"
        f"{note_line}\n"
        "Review it in Heap under Admin → Requests.\n\n"
        "— Heap"
    )
    return subject, body


def transaction_flagged(
    *,
    transaction_id: int,
    amount: Decimal | None,
    reason: str,
) -> tuple[str, str]:
    subject = f"[Heap] Transaction #{transaction_id} flagged for review"
    body = (
        "A transaction was flagged for manual review.\n\n"
        f"Transaction: #{transaction_id}\n"
        f"Amount: {_amount(amount)}\n"
        f"Reason: {reason}\n\n"
        "Review it in Heap under Admin.\n\n"
        "— Heap"
    )
    return subject, body
