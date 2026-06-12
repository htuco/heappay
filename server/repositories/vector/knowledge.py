import logging

import numpy as np
import psycopg
from pgvector.psycopg import register_vector

logger = logging.getLogger(__name__)


class VectorRepository:
    def __init__(self, db_url: str) -> None:
        self._db_url = db_url.replace("postgresql+psycopg://", "postgresql://")

    def _connect(self):
        conn = psycopg.connect(self._db_url)
        register_vector(conn)
        return conn

    def search(self, embedding: list[float], user_id: int, limit: int = 5) -> list[str]:
        try:
            with self._connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT content FROM knowledge_chunks WHERE user_id = %s ORDER BY embedding <=> %s LIMIT %s",
                        (user_id, np.array(embedding), limit),
                    )
                    return [row[0] for row in cur.fetchall()]
        except Exception:
            logger.exception("Vector search failed for user_id=%s", user_id)
            return []

    def replace_for_user(self, user_id: int, chunks: list[dict]) -> None:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM knowledge_chunks WHERE user_id = %s", (user_id,))
                for chunk in chunks:
                    cur.execute(
                        """INSERT INTO knowledge_chunks (user_id, content, embedding, source_type, source_id)
                           VALUES (%s, %s, %s, %s, %s)""",
                        (
                            user_id,
                            chunk["content"],
                            np.array(chunk["embedding"]),
                            chunk["source_type"],
                            chunk["source_id"],
                        ),
                    )
            conn.commit()
