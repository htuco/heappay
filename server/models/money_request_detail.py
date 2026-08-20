from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class MoneyRequestDetail(Base):
    __tablename__ = "money_request_details"
    __table_args__ = {"schema": "requests"}

    request_id: Mapped[int] = mapped_column(
        ForeignKey("requests.requests.request_id", ondelete="CASCADE"), primary_key=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    settled_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("money.transactions.transaction_id"), nullable=True
    )

    request = relationship("Request", back_populates="money_request_detail")
    settled_transaction = relationship("Transaction")
