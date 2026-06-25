"""enrich category rules with more global keywords

Revision ID: b6c2d3e4f5a7
Revises: a5f1c2d3e4b6
Create Date: 2026-06-25 14:50:00.000000

Adds a broader set of global keyword rules so common merchants/notes auto-tag.
Idempotent: skips a (keyword, match_field, global) rule that already exists, so
re-running (or overlap with the initial seed) never creates duplicates.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6c2d3e4f5a7"
down_revision: Union[str, Sequence[str], None] = "a5f1c2d3e4b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (keyword, match_field, category machine-name, priority). All global (user_id NULL).
NEW_RULES = [
    # subscriptions / streaming / software
    ("disney", "note", "subscriptions", 10),
    ("hulu", "note", "subscriptions", 10),
    ("hbo", "note", "subscriptions", 10),
    ("max", "note", "subscriptions", 30),
    ("prime video", "note", "subscriptions", 10),
    ("apple music", "note", "subscriptions", 10),
    ("icloud", "note", "subscriptions", 10),
    ("google one", "note", "subscriptions", 10),
    ("dropbox", "note", "subscriptions", 10),
    ("patreon", "note", "subscriptions", 10),
    ("audible", "note", "subscriptions", 10),
    ("notion", "note", "subscriptions", 10),
    ("github", "note", "subscriptions", 10),
    ("openai", "note", "subscriptions", 10),
    ("chatgpt", "note", "subscriptions", 10),
    ("adobe", "note", "subscriptions", 10),
    ("microsoft 365", "note", "subscriptions", 10),
    ("office 365", "note", "subscriptions", 10),
    ("subscription", "note", "subscriptions", 40),
    ("membership", "note", "subscriptions", 40),
    # transport / travel
    ("gas", "note", "transport", 20),
    ("fuel", "note", "transport", 10),
    ("petrol", "note", "transport", 10),
    ("shell", "note", "transport", 20),
    ("parking", "note", "transport", 10),
    ("metro", "note", "transport", 10),
    ("subway pass", "note", "transport", 10),
    ("train", "note", "transport", 20),
    ("bus ticket", "note", "transport", 10),
    ("flight", "note", "transport", 10),
    ("airline", "note", "transport", 10),
    ("ryanair", "note", "transport", 10),
    ("wizz", "note", "transport", 10),
    ("car wash", "note", "transport", 10),
    # groceries
    ("groceries", "note", "groceries", 10),
    ("walmart", "note", "groceries", 20),
    ("aldi", "note", "groceries", 10),
    ("lidl", "note", "groceries", 10),
    ("costco", "note", "groceries", 20),
    ("trader joe", "note", "groceries", 10),
    ("whole foods", "note", "groceries", 10),
    ("bakery", "note", "groceries", 20),
    ("butcher", "note", "groceries", 10),
    # food & dining
    ("mcdonald", "note", "food_dining", 10),
    ("burger", "note", "food_dining", 20),
    ("kfc", "note", "food_dining", 10),
    ("pizza", "note", "food_dining", 10),
    ("starbucks", "note", "food_dining", 10),
    ("dinner", "note", "food_dining", 30),
    ("lunch", "note", "food_dining", 30),
    ("breakfast", "note", "food_dining", 30),
    ("uber eats", "note", "food_dining", 5),
    ("doordash", "note", "food_dining", 10),
    ("grubhub", "note", "food_dining", 10),
    ("deliveroo", "note", "food_dining", 10),
    ("takeout", "note", "food_dining", 20),
    ("bar tab", "note", "food_dining", 20),
    # housing
    ("mortgage", "note", "housing", 10),
    ("landlord", "note", "housing", 10),
    ("lease", "note", "housing", 20),
    ("hoa", "note", "housing", 10),
    ("property", "note", "housing", 40),
    ("furniture", "note", "housing", 30),
    ("ikea", "note", "housing", 20),
    # utilities
    ("electricity", "note", "utilities", 10),
    ("power bill", "note", "utilities", 10),
    ("gas bill", "note", "utilities", 10),
    ("phone bill", "note", "utilities", 10),
    ("mobile", "note", "utilities", 30),
    ("broadband", "note", "utilities", 10),
    ("wifi", "note", "utilities", 20),
    ("verizon", "note", "utilities", 10),
    ("at&t", "note", "utilities", 10),
    ("comcast", "note", "utilities", 10),
    # health
    ("doctor", "note", "health", 10),
    ("dentist", "note", "health", 10),
    ("hospital", "note", "health", 10),
    ("clinic", "note", "health", 10),
    ("gym", "note", "health", 20),
    ("fitness", "note", "health", 20),
    ("insurance", "note", "health", 40),
    ("medical", "note", "health", 10),
    ("optician", "note", "health", 10),
    # shopping
    ("amazon", "note", "shopping", 20),
    ("ebay", "note", "shopping", 10),
    ("etsy", "note", "shopping", 10),
    ("zara", "note", "shopping", 10),
    ("h&m", "note", "shopping", 10),
    ("nike", "note", "shopping", 10),
    ("clothes", "note", "shopping", 30),
    ("shoes", "note", "shopping", 30),
    ("electronics", "note", "shopping", 30),
    ("best buy", "note", "shopping", 10),
    ("aliexpress", "note", "shopping", 10),
    # entertainment
    ("cinema", "note", "entertainment", 10),
    ("movie", "note", "entertainment", 20),
    ("concert", "note", "entertainment", 10),
    ("theatre", "note", "entertainment", 10),
    ("theater", "note", "entertainment", 10),
    ("game", "note", "entertainment", 30),
    ("steam", "note", "entertainment", 10),
    ("playstation", "note", "entertainment", 10),
    ("xbox", "note", "entertainment", 10),
    ("ticket", "note", "entertainment", 40),
    # income
    ("invoice", "note", "income", 20),
    ("refund", "note", "income", 40),
    ("bonus", "note", "income", 20),
    ("dividend", "note", "income", 10),
    ("reimbursement", "note", "income", 20),
    # fees
    ("fee", "note", "fees", 30),
    ("atm", "note", "fees", 10),
    ("overdraft", "note", "fees", 10),
    ("interest", "note", "fees", 30),
    ("service charge", "note", "fees", 10),
    ("late fee", "note", "fees", 5),
    # transfer
    ("transfer", "note", "transfer", 40),
    ("withdrawal", "note", "transfer", 30),
    ("top up", "note", "transfer", 30),
    ("top-up", "note", "transfer", 30),
]


def upgrade() -> None:
    for keyword, match_field, category_name, priority in NEW_RULES:
        # Insert only if no existing global rule already has this (keyword,
        # match_field) — keeps re-runs and overlap with the first seed clean.
        op.execute(
            sa.text(
                """
                INSERT INTO category_rules (user_id, match_field, keyword, category_id, priority)
                SELECT NULL, :match_field, :keyword, tc.transaction_category_id, :priority
                FROM transaction_categories tc
                WHERE tc.name = :category_name
                  AND NOT EXISTS (
                      SELECT 1 FROM category_rules cr
                      WHERE cr.user_id IS NULL
                        AND cr.match_field = :match_field
                        AND cr.keyword = :keyword
                  )
                """
            ).bindparams(
                match_field=match_field,
                keyword=keyword,
                category_name=category_name,
                priority=priority,
            )
        )


def downgrade() -> None:
    keywords = [r[0] for r in NEW_RULES]
    op.execute(
        sa.text(
            "DELETE FROM category_rules WHERE user_id IS NULL AND keyword = ANY(:kw)"
        ).bindparams(kw=keywords)
    )
