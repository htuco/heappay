from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class CategoryRule(Base):
    """Deterministic keyword rule for auto-categorising a transaction at create
    time when the user did not pick a category.

    A rule matches a lowercased substring (``keyword``) against either the
    transaction note or the recipient's name (``match_field``). ``user_id`` is
    nullable: NULL = a global/default rule that applies to everyone; a set
    user_id scopes the rule to that user (user rules take precedence over global
    ones). Lower ``priority`` wins.
    """

    __tablename__ = "category_keyword_rules"
    __table_args__ = (Index("ix_category_rules_lookup", "user_id", "priority"),
        Index("ix_category_keyword_rules_transaction_category_id", "transaction_category_id"),
        {"schema": "money"},
    )

    rule_id: Mapped[int] = mapped_column("category_rule_id", primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="CASCADE"), nullable=True
    )
    match_field: Mapped[str] = mapped_column(String(20), nullable=False)
    keyword: Mapped[str] = mapped_column(String(100), nullable=False)
    category_id: Mapped[int] = mapped_column("transaction_category_id", 
        ForeignKey("money.transaction_categories.transaction_category_id"), nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default="100")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    category = relationship("TransactionCategory")
