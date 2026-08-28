"""Repository tests: the card + free-text filters compile into the expected SQL.

These assert on the generated statement rather than querying, so they need no
database — the suite writes through DATABASE_URL and fabricated rows are the
source of the known FK failures.
"""
from repositories.transaction.transaction import TransactionRepository


def _sql(**kwargs) -> str:
    repo = TransactionRepository(None)
    stmt = repo._filtered_user_transactions_stmt(
        1, status_id=None, transaction_type_id=None, **kwargs
    )
    return str(stmt.compile(compile_kwargs={"literal_binds": True}))


def test_card_filter_matches_either_side_of_the_transaction():
    sql = _sql(card_id=7)
    assert "sender_card_id = 7" in sql
    assert "recipient_card_id = 7" in sql


def test_card_filter_is_absent_when_not_requested():
    sql = _sql()
    assert "sender_card_id = " not in sql


def test_search_covers_counterparty_card_and_lookup_fields():
    sql = _sql(search="coffee").lower()
    # Counterparty identity, via the card subquery.
    assert "cardholder_name" in sql
    assert "users.email" in sql
    assert "users.first_name" in sql
    assert "last_four" in sql
    assert "card_types.vendor" in sql
    # Status / type / category names, matched by label like the on-screen search.
    assert "transaction_statuses" in sql
    assert "transaction_types" in sql
    assert "transaction_categories" in sql
    # Amount, cast so a numeric column can be matched as text.
    assert "cast(" in sql


def test_search_matches_ids_only_for_a_numeric_query():
    numeric = _sql(search="42")
    assert "transactions.transaction_id = 42" in numeric
    # A non-numeric query must not produce an id comparison.
    assert "transaction_id = " not in _sql(search="coffee")


def test_search_escapes_like_wildcards():
    """A literal % in the query must not turn into a match-everything pattern."""
    sql = _sql(search="100%")
    assert r"100\%" in sql


def test_blank_search_adds_no_clause():
    assert "LIKE" not in _sql(search="   ")


def test_card_and_search_combine_with_the_other_filters():
    """The bug this fixes: selecting a card used to drop every other filter."""
    repo = TransactionRepository(None)
    stmt = repo._filtered_user_transactions_stmt(
        1, status_id=2, transaction_type_id=3, category_id=4, card_id=7, search="ada"
    )
    sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "transaction_status_id = 2" in sql
    assert "transactions.transaction_type_id = 3" in sql
    assert "transaction_category_id = 4" in sql
    assert "sender_card_id = 7" in sql
    assert "ada" in sql
