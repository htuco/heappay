from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Card(Base):
    __tablename__ = "cards"

    card_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    status_id: Mapped[int] = mapped_column(
        ForeignKey("card_statuses.card_status_id"), nullable=False
    )
    card_type_id: Mapped[int] = mapped_column(
        ForeignKey("card_types.card_type_id"), nullable=False
    )
    card_numb: Mapped[str] = mapped_column(String(32), nullable=False)
    last_four: Mapped[str] = mapped_column(String(4), nullable=False)
    cvc: Mapped[str] = mapped_column(String(4), nullable=False)
    expires_at: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="cards")
    status = relationship("CardStatus", back_populates="cards")
    card_type = relationship("CardType", back_populates="cards")
