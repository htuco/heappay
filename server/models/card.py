from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Card(Base):
    __tablename__ = "cards"
    __table_args__ = (
        # Table-level constraints resolve by DB column name, not attribute name.
        UniqueConstraint("card_number", name="uq_cards_card_numb"),
        # Enforces one main card per user, ignoring soft-deleted rows. Declared
        # here so autogenerate does not propose dropping it -- without this the
        # index exists only in the database and every diff wants to remove it.
        #
        # sqlite_where must mirror postgresql_where: the test suite builds its
        # schema on SQLite, which silently drops the postgresql_* variant.
        # Without it this degrades to a full UNIQUE(user_id) under tests -- one
        # card per user -- which is not what production enforces.
        Index(
            "unique_main_card_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_main = true AND deleted_at IS NULL"),
            sqlite_where=text("is_main = 1 AND deleted_at IS NULL"),
        ),
        # Hottest access path in the schema: Card.user_id is filtered in 21
        # repository/service sites and had no index at all (audit F-06).
        # Partial, because every list path excludes soft-deleted cards.
        Index(
            "ix_cards_user_id",
            "user_id",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("ix_cards_card_status_id", "card_status_id"),
        Index("ix_cards_card_type_id", "card_type_id"),
        CheckConstraint("balance >= 0", name="ck_cards_balance_non_negative"),
        {"schema": "money"},
    )

    card_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("identity.users.user_id"), nullable=False)
    status_id: Mapped[int] = mapped_column("card_status_id", 
        ForeignKey("money.card_statuses.card_status_id"), nullable=False
    )
    card_type_id: Mapped[int] = mapped_column(
        ForeignKey("money.card_types.card_type_id"), nullable=False
    )
    card_numb: Mapped[str] = mapped_column("card_number", String(32), nullable=False)
    last_four: Mapped[str] = mapped_column(String(4), nullable=False)
    cvc: Mapped[str] = mapped_column(String(4), nullable=False)
    cardholder_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expires_at: Mapped[date] = mapped_column("expires_on", Date, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_main: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    user = relationship("User", back_populates="cards")
    status = relationship("CardStatus", back_populates="cards")
    card_type = relationship("CardType", back_populates="cards")
