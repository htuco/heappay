from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class PasswordHistory(Base):
    """Previous password hashes for a user (most recent first by created_at)."""

    __tablename__ = "password_history"
    __table_args__ = (
        Index("ix_password_history_user_id_created_at", "user_id", "created_at"),
        {"schema": "security"},
    )

    history_id: Mapped[int] = mapped_column("password_history_id", primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="CASCADE"), nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user = relationship("User", back_populates="password_history")
