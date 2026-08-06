from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from models.chat_message import ChatMessage

# A pause longer than this ends the conversation: everything before it belongs to
# an earlier session and is neither shown to the user nor sent to the model. The
# rows stay in the table -- this is a read-time window, not a delete.
SESSION_IDLE_MINUTES = 30


class ChatRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_history(
        self, user_id: int, agent_mode: bool = False, limit: int = 20
    ) -> list[ChatMessage]:
        """Messages from the current session only, oldest first.

        Trimming happens here rather than in the service so the model context and
        the history the widget renders can never disagree about what "the
        conversation" is.
        """
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
        return _current_session(rows)

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
        """Delete this mode's history. The other mode is deliberately untouched --
        Chat and Actions are separate conversations."""
        self._db.execute(
            delete(ChatMessage).where(
                ChatMessage.user_id == user_id,
                ChatMessage.agent_mode == agent_mode,
            )
        )
        self._db.commit()


def _current_session(rows: list[ChatMessage]) -> list[ChatMessage]:
    """Drop everything before the last pause longer than SESSION_IDLE_MINUTES.

    Walks backwards from the newest message, so a conversation that ran for hours
    without a long break survives whole, while yesterday's exchange never
    resurfaces on top of today's first question.
    """
    if not rows:
        return rows

    gap = timedelta(minutes=SESSION_IDLE_MINUTES)
    start = 0
    for i in range(len(rows) - 1, 0, -1):
        previous, current = rows[i - 1].created_at, rows[i].created_at
        if previous is None or current is None:
            continue
        if current - previous > gap:
            start = i
            break
    return rows[start:]
