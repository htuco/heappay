from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class BiometricAuthenticationChallenge(Base):
    __tablename__ = "biometric_authentication_challenges"
    __table_args__ = (
        Index("idx_biometric_auth_challenges_user_id", "user_id"),
        Index("idx_biometric_auth_challenges_transaction_id", "transaction_id"),
        Index("idx_biometric_auth_challenges_expires_at", "expires_at"),
        {"schema": "security"},
    )

    challenge_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("money.transactions.transaction_id", ondelete="CASCADE"),
        nullable=True,
    )
    challenge: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="biometric_authentication_challenges")
    transaction = relationship("Transaction")
