from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class TransactionDraft(Base):
    """A payment the user assembled but has not sent.

    Deliberately its own table rather than a "draft" status on transactions: a
    draft is not a transaction, and keeping it out of that table is what
    guarantees it can never leak into balances, history, spending summaries,
    escrow or the settle path. Nothing has to remember to filter it out.

    Every payment field is nullable because a draft is allowed to be
    incomplete -- the whole point is saving a half-finished payment. Validation
    happens when it is sent, through the normal transaction create path.
    """

    __tablename__ = "transaction_drafts"
    __table_args__ = (
        CheckConstraint(
            "amount IS NULL OR amount > 0", name="ck_transaction_drafts_amount_positive"
        ),
        Index("ix_transaction_drafts_user_id", "user_id"),
        Index("ix_transaction_drafts_sender_card_id", "sender_card_id"),
        Index("ix_transaction_drafts_recipient_card_id", "recipient_card_id"),
        Index("ix_transaction_drafts_transaction_category_id", "transaction_category_id"),
        {"schema": "money"},
    )

    draft_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="CASCADE"), nullable=False
    )
    sender_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("money.cards.card_id", ondelete="SET NULL"), nullable=True
    )
    recipient_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("money.cards.card_id", ondelete="SET NULL"), nullable=True
    )
    transaction_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("money.transaction_types.transaction_type_id"), nullable=True
    )
    category_id: Mapped[int | None] = mapped_column(
        "transaction_category_id",
        ForeignKey("money.transaction_categories.transaction_category_id"),
        nullable=True,
    )
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    sender_card = relationship("Card", foreign_keys=[sender_card_id])
    recipient_card = relationship("Card", foreign_keys=[recipient_card_id])
    category = relationship("TransactionCategory")
