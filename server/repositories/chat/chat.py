from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from models.chat_message import ChatMessage


class ChatRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_history(self, user_id: int, limit: int = 20) -> list[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
        )
        return list(self._db.execute(stmt).scalars().all())

    def save_message(self, user_id: int, role: str, content: str) -> ChatMessage:
        row = ChatMessage(user_id=user_id, role=role, content=content)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def clear_history(self, user_id: int) -> None:
        self._db.execute(delete(ChatMessage).where(ChatMessage.user_id == user_id))
        self._db.commit()
