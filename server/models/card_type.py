from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class CardType(Base):
    __tablename__ = "card_types"
    __table_args__ = (
        UniqueConstraint("name", "vendor", name="uq_card_types_type_name_vendor"),
        {"schema": "money"},
    )

    card_type_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type_name: Mapped[str] = mapped_column("name", String(100), nullable=False)
    vendor: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cards = relationship("Card", back_populates="card_type")
