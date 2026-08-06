"""Keyword auto-categorisation, shared by the two paths that create payments.

`TransactionService.create` (a user pressing send) and
`RecurringPaymentService.run_due_payments` (the scheduler) both have to answer
"which category does this payment belong to?", and they have to answer it the
same way — a scheduled Spotify payment must land where the identical manual one
lands. The matching lives here so neither path owns it.

In both paths an explicit category always wins; these rules only ever fill a
category that is otherwise absent.
"""

from typing import Callable, Iterable, Protocol


class _CategoryRule(Protocol):
    keyword: str | None
    match_field: str | None
    category_id: int | None


def recipient_display_name(recipient_card) -> str | None:
    """Best-effort display name for the recipient, used for keyword matching."""
    if recipient_card is None:
        return None
    user = getattr(recipient_card, "user", None)
    if user is not None:
        parts = [getattr(user, "first_name", None), getattr(user, "last_name", None)]
        name = " ".join(p for p in parts if p).strip()
        if name:
            return name
    return getattr(recipient_card, "cardholder_name", None)


def resolve_auto_category(
    load_rules: Callable[[], Iterable[_CategoryRule]],
    *,
    note: str | None,
    recipient_name: str | None,
) -> int | None:
    """Return the category_id of the first matching keyword rule, or None.

    Deterministic substring match (lowercased) on the note / recipient name.
    The rules are expected pre-ordered by precedence (user rules before global,
    then priority asc — see `CategoryRuleRepository.list_applicable`), so the
    first match wins. No ML, no MCC.

    `load_rules` is a callable rather than a list so that a payment with neither
    a note nor a recipient name — which can never match anything — costs no
    query at all.
    """
    note_text = (note or "").lower()
    recipient_text = (recipient_name or "").lower()
    if not note_text and not recipient_text:
        return None

    for rule in load_rules():
        haystack = recipient_text if rule.match_field == "recipient_name" else note_text
        if rule.keyword and rule.keyword.lower() in haystack:
            return rule.category_id
    return None
