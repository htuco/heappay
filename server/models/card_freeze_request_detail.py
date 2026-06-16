from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class CardFreezeRequestDetail(Base):
    __tablename__ = "card_freeze_request_details"

    request_id: Mapped[int] = mapped_column(
        ForeignKey("requests.request_id", ondelete="CASCADE"), primary_key=True
    )
    card_id: Mapped[int] = mapped_column(
        ForeignKey("cards.card_id"), nullable=False
    )

    request = relationship("Request", back_populates="card_freeze_detail")
    card = relationship("Card")
