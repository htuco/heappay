from datetime import datetime, timedelta
from types import SimpleNamespace

from routes.export.export import _build_transactions_context_line, _format_date_range
from services.export import pdf_export
from services.export.pdf_export import (
    _counterparty,
    _money,
    _status_palette,
    _truncate,
    build_monthly_report_pdf,
    build_transactions_pdf,
    build_wallet_summary_pdf,
)


def _make_user(user_id: int = 1):
    return SimpleNamespace(
        user_id=user_id, first_name="Ada", last_name="Lovelace", email="ada@example.com"
    )


def _card(user_id: int, first_name: str, last_name: str, last_four: str = "0005"):
    return SimpleNamespace(
        user_id=user_id,
        last_four=last_four,
        user=SimpleNamespace(first_name=first_name, last_name=last_name),
    )


def _txn(*, user_id, outgoing, amount, status="completed", category="Groceries",
         txn_type="transfer", when=None, counterparty="Grace Hopper"):
    when = when or datetime(2026, 6, 15, 10, 30)
    first, _, last = counterparty.partition(" ")
    own = _card(user_id, "Ada", "Lovelace")
    other = _card(user_id + 1, first or "Grace", last or "Hopper")
    sender, recipient = (own, other) if outgoing else (other, own)
    return SimpleNamespace(
        created_at=when,
        amount=amount,
        sender_card=sender,
        recipient_card=recipient,
        transaction_type=SimpleNamespace(name=txn_type),
        category=SimpleNamespace(name=category),
        status=SimpleNamespace(name=status),
    )


def _is_pdf(data: bytes) -> bool:
    return isinstance(data, bytes) and data.startswith(b"%PDF") and len(data) > 800


def test_money_and_truncate_helpers():
    assert _money(1234.5) == "$1,234.50"
    assert _truncate("short", 10) == "short"
    long = _truncate("a very long counterparty name that overflows", 20)
    assert len(long) <= 20
    assert long.endswith("\u2026")


def test_status_palette_known_and_default():
    completed_bg, completed_fg = _status_palette("Completed")
    failed_bg, failed_fg = _status_palette("failed")
    default_bg, default_fg = _status_palette("something-else")
    assert completed_fg != failed_fg
    assert (default_bg, default_fg) == pdf_export._STATUS_DEFAULT


def test_counterparty_direction():
    user = _make_user(1)
    out = _txn(user_id=1, outgoing=True, amount=50)
    inc = _txn(user_id=1, outgoing=False, amount=75)
    assert _counterparty(out, user.user_id)[0] == "-"
    assert _counterparty(inc, user.user_id)[0] == "+"


def test_transactions_pdf_renders_with_totals():
    user = _make_user(1)
    txns = [
        _txn(user_id=1, outgoing=True, amount=40, status="completed"),
        _txn(user_id=1, outgoing=False, amount=100, status="pending"),
        _txn(user_id=1, outgoing=True, amount=10, status="failed"),
    ]
    pdf = build_transactions_pdf(
        user, txns, total_count=3, shown_count=3, context_line="Filters: All transactions \u00b7 Newest first"
    )
    assert _is_pdf(pdf)


def test_transactions_pdf_empty_renders():
    user = _make_user(1)
    pdf = build_transactions_pdf(user, [], total_count=0, shown_count=0)
    assert _is_pdf(pdf)


def test_transactions_pdf_multipage_and_long_names():
    user = _make_user(1)
    base = datetime(2026, 6, 1, 9, 0)
    txns = [
        _txn(
            user_id=1,
            outgoing=(i % 2 == 0),
            amount=10 + i,
            status=["completed", "pending", "failed"][i % 3],
            category="A very long category name for wrapping tests",
            counterparty="Alexandria Ocasio-Cortez Superlongname",
            when=base + timedelta(days=i),
        )
        for i in range(120)
    ]
    pdf = build_transactions_pdf(
        user, txns, total_count=600, shown_count=120,
        context_line="Filters: Completed \u00b7 Newest first",
    )
    assert _is_pdf(pdf)
    # Multi-page output should be materially larger than a single-page doc.
    assert len(pdf) > 5000


def test_wallet_summary_pdf_still_renders():
    user = _make_user(1)
    cards = [
        SimpleNamespace(
            balance=1200.5,
            last_four="0005",
            expires_at=datetime(2028, 1, 1).date(),
            card_type=SimpleNamespace(vendor="Visa", type_name="Debit"),
            status=SimpleNamespace(status_name="active"),
        )
    ]
    assert _is_pdf(build_wallet_summary_pdf(user, cards))
    assert _is_pdf(build_wallet_summary_pdf(user, []))


def test_monthly_report_pdf_still_renders():
    user = _make_user(1)
    summary = [{"period": "Jun 2026", "income": 2000, "expense": 800}]
    breakdown = [{"name": "Groceries", "total": 300, "count": 5}]
    assert _is_pdf(build_monthly_report_pdf(user, summary, breakdown, months=1))
    assert _is_pdf(build_monthly_report_pdf(user, [], [], months=6))


def test_context_line_builder():
    line = _build_transactions_context_line(
        {"status": "completed", "type": "transfer", "category": "Groceries"}, "amount_desc"
    )
    assert line == "Filters: Status: Completed \u00b7 Type: Transfer \u00b7 Category: Groceries \u00b7 Amount: high to low"
    empty = _build_transactions_context_line({}, "newest")
    assert empty == "Filters: All transactions \u00b7 Newest first"


def test_context_line_includes_date_range():
    txns = [
        _txn(user_id=1, outgoing=True, amount=10, when=datetime(2026, 6, 1, 9, 0)),
        _txn(user_id=1, outgoing=False, amount=20, when=datetime(2026, 8, 6, 9, 0)),
    ]
    line = _build_transactions_context_line({"status": "completed"}, "newest", txns)
    assert "Jun 01 \u2013 Aug 06, 2026" in line
    assert line.startswith("Filters: Status: Completed")
    assert line.endswith("Newest first")


def test_format_date_range_variants():
    same_day = [
        _txn(user_id=1, outgoing=True, amount=1, when=datetime(2026, 6, 1, 9, 0)),
        _txn(user_id=1, outgoing=True, amount=1, when=datetime(2026, 6, 1, 18, 0)),
    ]
    assert _format_date_range(same_day) == "Jun 01, 2026"
    cross_year = [
        _txn(user_id=1, outgoing=True, amount=1, when=datetime(2025, 12, 30, 9, 0)),
        _txn(user_id=1, outgoing=True, amount=1, when=datetime(2026, 1, 2, 9, 0)),
    ]
    assert _format_date_range(cross_year) == "Dec 30, 2025 \u2013 Jan 02, 2026"
    assert _format_date_range([]) is None
