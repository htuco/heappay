from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class RefundRequestDetail(Base):
    __tablename__ = "refund_details"
    __table_args__ = (
        UniqueConstraint("transaction_id", name="uq_refund_request_per_transaction"),
        {"schema": "requests"},
    )

    request_id: Mapped[int] = mapped_column(
        ForeignKey("requests.requests.request_id", ondelete="CASCADE"), primary_key=True
    )
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("money.transactions.transaction_id"), nullable=False
    )
    reason_code: Mapped[str | None] = mapped_column(String(30), nullable=True)

    request = relationship("Request", back_populates="refund_detail")
    transaction = relationship("Transaction")
