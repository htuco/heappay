import logging
from datetime import date

from groq import Groq

from models.chat_message import ChatMessage
from repositories.card.card import CardRepository
from repositories.chat.chat import ChatRepository
from repositories.transaction.transaction import TransactionRepository
from repositories.user.user import UserRepository
from repositories.vector.knowledge import VectorRepository
from services.embedding.embedding import EmbeddingService

logger = logging.getLogger(__name__)

_ROLE_MAP = {"model": "assistant"}


class ChatService:
    def __init__(
        self,
        repo: ChatRepository,
        card_repo: CardRepository,
        transaction_repo: TransactionRepository,
        user_repo: UserRepository,
        api_key: str,
        vector_repo: VectorRepository | None = None,
        embedding_service: EmbeddingService | None = None,
    ) -> None:
        self._repo = repo
        self._card_repo = card_repo
        self._transaction_repo = transaction_repo
        self._user_repo = user_repo
        self._client = Groq(api_key=api_key)
        self._vector_repo = vector_repo
        self._embedding_service = embedding_service

    def _format_cards(self, cards: list) -> list[str]:
        if not cards:
            return ["   Cards: No cards found."]
        lines = ["   Cards:"]
        for card in cards:
            card_type = f"{card.card_type.vendor} {card.card_type.type_name}" if card.card_type else "Card"
            status = card.status.status_name if card.status else "unknown"
            lines.append(
                f"   - {card_type} (*{card.last_four}) | Balance: {card.balance}€"
                f" | Status: {status} | Expires: {card.expires_at}"
            )
        return lines

    def _format_transactions(self, transactions: list, limit_label: int) -> list[str]:
        if not transactions:
            return [f"   Recent transactions (last {limit_label}): No transactions found."]
        lines = [f"   Recent transactions (last {limit_label}):"]
        for txn in transactions:
            txn_type = txn.transaction_type.name if txn.transaction_type else "transfer"
            status = txn.status.name if txn.status else "unknown"
            note = f" [{txn.note}]" if txn.note else ""
            created = txn.created_at.strftime("%Y-%m-%d")
            lines.append(f"   - {created}: {txn_type} {txn.amount}€{note} — {status}")
        return lines

    def _user_context_from_vector(self, user_id: int, message: str) -> str | None:
        if not self._vector_repo or not self._embedding_service:
            return None
        try:
            query_emb = self._embedding_service.embed_query(message)
            chunks = self._vector_repo.search(query_emb, user_id, limit=5)
            if chunks:
                return "\n".join(chunks)
        except Exception:
            logger.exception("Vector search failed for user_id=%s, falling back to live data", user_id)
        return None

    def _user_context_from_repo(self, user_id: int) -> str:
        user = self._user_repo.get_by_id(user_id)
        cards = self._card_repo.list_all(user_id=user_id)
        transactions = self._transaction_repo.list_for_user(user_id=user_id, limit=5)

        lines = []
        if user:
            lines.append(f"User: {user.first_name} {user.last_name}")
            lines.append("")

        lines.append("Cards:")
        if cards:
            for card in cards:
                card_type = f"{card.card_type.vendor} {card.card_type.type_name}" if card.card_type else "Card"
                status = card.status.status_name if card.status else "unknown"
                lines.append(
                    f"- {card_type} (*{card.last_four}) | Balance: {card.balance}€"
                    f" | Status: {status} | Expires: {card.expires_at}"
                )
        else:
            lines.append("- No cards found.")
        lines.append("")

        lines.append("Recent transactions (last 5):")
        if transactions:
            for txn in transactions:
                txn_type = txn.transaction_type.name if txn.transaction_type else "transfer"
                status = txn.status.name if txn.status else "unknown"
                note = f" [{txn.note}]" if txn.note else ""
                created = txn.created_at.strftime("%Y-%m-%d")
                lines.append(f"- {created}: {txn_type} {txn.amount}€{note} — {status}")
        else:
            lines.append("- No transactions found.")

        return "\n".join(lines)

    def _build_system_message(self, user_id: int, message: str, is_admin: bool) -> str:
        today = date.today().isoformat()

        if is_admin:
            lines = [
                'You are an admin assistant for "heap", a digital wallet app.',
                "You have full access to all users, their cards, and their transactions.",
                "Help the admin with anything they ask about users, finances, or the platform.",
                "Always respond in the same language the admin writes in. Always use Latin script (never Cyrillic).",
                "Be concise and precise. Today's date is " + today + ".",
                "",
            ]
            all_users = self._user_repo.list_users(
                email=None, status_id=None, user_role_id=None,
                include_deleted=False, limit=200, offset=0,
            )
            lines.append(f"All users ({len(all_users)} total):")
            lines.append("")
            for i, u in enumerate(all_users, 1):
                lines.append(f"{i}. {u.first_name} {u.last_name} ({u.email}) | ID: {u.user_id}")
                cards = self._card_repo.list_all(user_id=u.user_id)
                lines.extend(self._format_cards(cards))
                txns = self._transaction_repo.list_for_user(user_id=u.user_id, limit=3)
                lines.extend(self._format_transactions(txns, 3))
                lines.append("")
        else:
            lines = [
                'You are a helpful assistant for "heap", a digital wallet app.',
                "Help the user with anything they ask — prioritise questions about their finances, cards, and transactions, but you may answer general questions too.",
                "Always respond in the same language the user writes in. Always use Latin script (never Cyrillic).",
                "Be concise and friendly. Today's date is " + today + ".",
                "",
            ]
            context = self._user_context_from_vector(user_id, message) or self._user_context_from_repo(user_id)
            lines.append(context)

        return "\n".join(lines)

    def send_message(self, user_id: int, message: str, is_admin: bool = False) -> tuple[str, list[ChatMessage]]:
        history = self._repo.get_history(user_id)

        system_content = self._build_system_message(user_id, message, is_admin)
        messages = [{"role": "system", "content": system_content}]
        messages += [
            {"role": _ROLE_MAP.get(msg.role, msg.role), "content": msg.content}
            for msg in history
        ]
        messages.append({"role": "user", "content": message})

        try:
            response = self._client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
            )
        except Exception:
            logger.exception("Groq API call failed for user_id=%s", user_id)
            raise
        reply = response.choices[0].message.content

        self._repo.save_message(user_id, "user", message)
        self._repo.save_message(user_id, "assistant", reply)

        updated_history = self._repo.get_history(user_id)
        return reply, updated_history

    def get_history(self, user_id: int) -> list[ChatMessage]:
        return self._repo.get_history(user_id)

    def clear_history(self, user_id: int) -> None:
        self._repo.clear_history(user_id)
