from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chat_messages_user_mode", "user_id", "is_agent_mode", "created_at"),
        {"schema": "audit"},
    )

    id: Mapped[int] = mapped_column("chat_message_id", primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("identity.users.user_id"), nullable=False)
    role: Mapped[str] = mapped_column(String(10), nullable=False)  # "user" | "model"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    agent_mode: Mapped[bool] = mapped_column("is_agent_mode", 
        Boolean, nullable=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user = relationship("User")
