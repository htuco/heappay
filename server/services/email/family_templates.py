"""Email templates for guardian<->dependent family-package notifications."""
from decimal import Decimal


def _amount(value: Decimal | str | None) -> str:
    if value is None:
        return "n/a"
    return f"${Decimal(str(value)):,.2f}"


def family_link_invited(*, guardian_name: str) -> tuple[str, str]:
    subject = "[Heap] You've been invited to a family account"
    body = (
        f"{guardian_name} invited you to link accounts as their dependent on Heap.\n\n"
        "Accept the invite in Heap under Family to let them set an allowance, "
        "spending limits, and manage your cards.\n\n"
        "If you don't recognize this, you can safely decline.\n\n"
        "— Heap"
    )
    return subject, body


def family_link_accepted(*, dependent_name: str) -> tuple[str, str]:
    subject = "[Heap] Family invite accepted"
    body = (
        f"{dependent_name} accepted your family invite on Heap.\n\n"
        "You can now set an allowance, spending limits, and manage their cards "
        "under Family.\n\n"
        "— Heap"
    )
    return subject, body


def allowance_received(*, guardian_name: str, amount: Decimal) -> tuple[str, str]:
    subject = "[Heap] Allowance received"
    body = (
        f"{guardian_name} sent you {_amount(amount)}.\n\n"
        "It's already in your wallet balance.\n\n"
        "— Heap"
    )
    return subject, body


def spending_limit_changed(*, guardian_name: str) -> tuple[str, str]:
    subject = "[Heap] Your spending limits changed"
    body = (
        f"{guardian_name} updated a spending limit on your account.\n\n"
        "Check Family in Heap for the current limits.\n\n"
        "— Heap"
    )
    return subject, body


def approval_requested(*, dependent_name: str, amount: Decimal) -> tuple[str, str]:
    subject = "[Heap] A dependent's payment needs your approval"
    body = (
        f"{dependent_name} is trying to send {_amount(amount)}, which needs your "
        "sign-off under a spending limit you set.\n\n"
        "Review it in Heap under Transactions → Pending approvals.\n\n"
        "— Heap"
    )
    return subject, body


def shared_card_spend(*, dependent_name: str, amount: Decimal) -> tuple[str, str]:
    subject = "[Heap] Spend on your shared family card"
    body = (
        f"{dependent_name} spent {_amount(amount)} from your shared family card.\n\n"
        "Check Family in Heap to review the transaction or adjust their limits.\n\n"
        "— Heap"
    )
    return subject, body
