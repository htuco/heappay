from sqlalchemy import ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class CardFreezeRequestDetail(Base):
    __tablename__ = "card_freeze_details"
    __table_args__ = (Index("idx_card_freeze_details_card", "card_id"),
        {"schema": "requests"},
    )

    request_id: Mapped[int] = mapped_column(
        ForeignKey("requests.requests.request_id", ondelete="CASCADE"), primary_key=True
    )
    card_id: Mapped[int] = mapped_column(
        ForeignKey("money.cards.card_id"), nullable=False
    )

    request = relationship("Request", back_populates="card_freeze_detail")
    card = relationship("Card")
