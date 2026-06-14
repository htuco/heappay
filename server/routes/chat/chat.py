from fastapi import APIRouter, Depends, HTTPException, Response, status
from groq import APIError as GroqAPIError
from sqlalchemy.orm import Session

from database import get_db
from repositories.card.card import CardRepository
from repositories.chat.chat import ChatRepository
from repositories.transaction.transaction import TransactionRepository
from repositories.user.user import UserRepository
from repositories.vector.knowledge import VectorRepository
from routes.dependencies import UserContext, get_user_context
from schemas.chat import ChatMessageOut, ChatRequest, ChatResponse
from services.chat.chat import ChatService
from services.embedding.embedding import EmbeddingService
from settings import get_settings

router = APIRouter(prefix="/chat", tags=["chat"])

_CHAT_UNAVAILABLE = (
    "The AI assistant is not configured on this server. "
    "Please try again later or contact support."
)


def get_vector_repo() -> VectorRepository | None:
    s = get_settings()
    if not s.supabase_database_url:
        return None
    return VectorRepository(s.supabase_database_url)


def get_embedding_service() -> EmbeddingService | None:
    s = get_settings()
    if not s.cohere_api_key:
        return None
    return EmbeddingService(s.cohere_api_key)


def get_chat_service(db: Session = Depends(get_db)) -> ChatService:
    return ChatService(
        ChatRepository(db),
        CardRepository(db),
        TransactionRepository(db),
        UserRepository(db),
        get_settings().groq_api_key,
        vector_repo=get_vector_repo(),
        embedding_service=get_embedding_service(),
    )


@router.post("/message", response_model=ChatResponse)
def send_message(
    payload: ChatRequest,
    ctx: UserContext = Depends(get_user_context),
    service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    # Degrade visibly when the AI provider key is not configured, instead of
    # letting an empty key surface as an opaque 500 from the Groq client.
    if not get_settings().groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_CHAT_UNAVAILABLE,
        )
    try:
        reply, history = service.send_message(ctx.user_id, payload.message, is_admin=ctx.is_admin)
    except GroqAPIError as exc:
        if exc.status_code == 429:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="AI quota exceeded. Try again later.") from exc
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service unavailable.") from exc
    return ChatResponse(
        reply=reply,
        history=[ChatMessageOut.model_validate(m) for m in history],
    )


@router.get("/history", response_model=list[ChatMessageOut])
def get_history(
    ctx: UserContext = Depends(get_user_context),
    service: ChatService = Depends(get_chat_service),
) -> list[ChatMessageOut]:
    return [ChatMessageOut.model_validate(m) for m in service.get_history(ctx.user_id)]


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(
    ctx: UserContext = Depends(get_user_context),
    service: ChatService = Depends(get_chat_service),
) -> Response:
    service.clear_history(ctx.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
