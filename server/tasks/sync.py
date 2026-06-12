import logging

from database import SessionLocal
from repositories.vector.knowledge import VectorRepository
from services.embedding.embedding import EmbeddingService
from settings import get_settings
from tasks.knowledge_sync import KnowledgeSyncTask

logger = logging.getLogger(__name__)


def run_sync_for_user(user_id: int) -> None:
    s = get_settings()
    if not s.supabase_database_url or not s.cohere_api_key:
        return
    db = SessionLocal()
    try:
        task = KnowledgeSyncTask(
            db=db,
            vector_repo=VectorRepository(s.supabase_database_url),
            embedding_service=EmbeddingService(s.cohere_api_key),
        )
        task.sync_user(user_id)
    except Exception:
        logger.exception("Event-driven sync failed for user_id=%s", user_id)
    finally:
        db.close()
