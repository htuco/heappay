from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from models.chat_message import ChatMessage


class ChatRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_history(
        self, user_id: int, agent_mode: bool = False, limit: int = 20
    ) -> list[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .where(
                ChatMessage.user_id == user_id,
                ChatMessage.agent_mode == agent_mode,
            )
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .limit(limit)
        )
        rows = list(self._db.execute(stmt).scalars().all())
        rows.reverse()
        return rows

    def save_message(
        self, user_id: int, role: str, content: str, agent_mode: bool = False
    ) -> ChatMessage:
        row = ChatMessage(
            user_id=user_id, role=role, content=content, agent_mode=agent_mode
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def clear_history(self, user_id: int, agent_mode: bool = False) -> None:
        self._db.execute(
            delete(ChatMessage).where(
                ChatMessage.user_id == user_id,
                ChatMessage.agent_mode == agent_mode,
            )
        )
        self._db.commit()
