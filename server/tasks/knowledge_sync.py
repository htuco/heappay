import logging

from cohere.errors import TooManyRequestsError
from sqlalchemy.orm import Session

from repositories.card.card import CardRepository
from repositories.transaction.transaction import TransactionRepository
from repositories.user.user import UserRepository
from repositories.vector.knowledge import VectorRepository
from services.embedding.embedding import EmbeddingService

logger = logging.getLogger(__name__)

_BATCH_SIZE = 48


class KnowledgeSyncTask:
    def __init__(
        self,
        db: Session,
        vector_repo: VectorRepository,
        embedding_service: EmbeddingService,
    ) -> None:
        self._user_repo = UserRepository(db)
        self._card_repo = CardRepository(db)
        self._transaction_repo = TransactionRepository(db)
        self._vector_repo = vector_repo
        self._embedding_service = embedding_service

    def _build_chunks(self, user_id: int) -> list[dict]:
        chunks = []

        for card in self._card_repo.list_all(user_id=user_id):
            card_type = f"{card.card_type.vendor} {card.card_type.type_name}" if card.card_type else "Card"
            status = card.status.status_name if card.status else "unknown"
            text = (
                f"Card: {card_type} *{card.last_four}, "
                f"balance ${card.balance}, status {status}, expires {card.expires_at}"
            )
            chunks.append({"content": text, "source_type": "card", "source_id": card.card_id})

        for txn in self._transaction_repo.list_for_user(user_id=user_id, limit=50):
            txn_type = txn.transaction_type.name if txn.transaction_type else "transfer"
            status = txn.status.name if txn.status else "unknown"
            note = f" ({txn.note})" if txn.note else ""
            created = txn.created_at.strftime("%Y-%m-%d")
            text = f"Transaction: {created}, {txn_type}, ${txn.amount}{note}, status {status}"
            chunks.append({"content": text, "source_type": "transaction", "source_id": txn.transaction_id})

        return chunks

    def sync_user(self, user_id: int) -> None:
        chunks = self._build_chunks(user_id)
        if not chunks:
            return
        for i in range(0, len(chunks), _BATCH_SIZE):
            batch = chunks[i : i + _BATCH_SIZE]
            embeddings = self._embedding_service.embed_documents([c["content"] for c in batch])
            for chunk, emb in zip(batch, embeddings):
                chunk["embedding"] = emb
        self._vector_repo.replace_for_user(user_id, chunks)
        logger.info("Synced user_id=%s (%d chunks)", user_id, len(chunks))

    def run(self) -> None:
        logger.info("Knowledge sync started")
        users = self._user_repo.list_users(
            email=None, status_id=None, user_role_id=None,
            include_deleted=False, limit=500, offset=0,
        )
        for user in users:
            try:
                self.sync_user(user.user_id)
            except TooManyRequestsError:
                logger.warning("Knowledge sync stopped early: Cohere rate limit reached.")
                return
            except Exception:
                logger.exception("Failed to sync user_id=%s", user.user_id)

        logger.info("Knowledge sync completed")
