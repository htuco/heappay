import logging
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from database import SessionLocal
from ratelimit import DEFAULT_RATE_LIMIT_MESSAGE, limiter
from exceptions import AppException
from repositories.vector.knowledge import VectorRepository
from routes import health, system
from routes.card.card import router as card_router
from routes.card.card_status import router as card_status_router
from routes.card.card_type import router as card_type_router
from routes.chat.chat import router as chat_router
from routes.contact.contact import router as contact_router
from routes.export.export import router as export_router
from routes.family.allowance import router as family_allowance_router
from routes.family.family_link import router as family_link_router
from routes.family.spending_limit_rule import router as family_spending_limit_router
from routes.fx.fx import router as fx_router
from routes.storage.images import router as storage_router
from routes.transaction.transaction import router as transaction_router
from routes.wallet.wallet import router as wallet_router
from routes.transaction.transaction_category import router as transaction_category_router
from routes.transaction.transaction_type import router as transaction_type_router
from routes.nexus.funding import router as nexus_funding_router
from routes.recurring_payment.recurring_payment import router as recurring_payment_router
from routes.refund_approval_rule.refund_approval_rule import router as refund_approval_rule_router
from routes.request.request import router as request_router
from routes.audit_log.audit_log import router as audit_log_router
from routes.user.auth import router as auth_router
from routes.user.user import router as users_router
from routes.user.user_role import router as user_role_router
from routes.user.user_status import router as user_status_router
from services.embedding.embedding import EmbeddingService
from jobs.scheduler import lifespan as transaction_processor_lifespan
from services.nexus.funding import sync_nexus_env
from settings import get_settings
from tasks.knowledge_sync import KnowledgeSyncTask

logger = logging.getLogger(__name__)


def _run_knowledge_sync() -> None:
    s = get_settings()
    if not s.supabase_database_url or not s.cohere_api_key:
        logger.warning("Knowledge sync skipped: SUPABASE_DATABASE_URL or COHERE_API_KEY not set")
        return
    db = SessionLocal()
    try:
        task = KnowledgeSyncTask(
            db=db,
            vector_repo=VectorRepository(s.supabase_database_url),
            embedding_service=EmbeddingService(s.cohere_api_key),
        )
        task.run()
    finally:
        db.close()


def create_app() -> FastAPI:
    settings = get_settings()
    sync_nexus_env()
    app = FastAPI(lifespan=transaction_processor_lifespan(settings))
    cors_kwargs: dict = {
        "allow_origins": settings.cors_origin_list,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    cors_kwargs["allow_origin_regex"] = r"http://(localhost|127\.0\.0\.1)(:\d+)?"
    app.add_middleware(CORSMiddleware, **cors_kwargs)

    # Rate limiting (slowapi) — throttles the brute-forceable auth routes.
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        limit_text = str(getattr(exc.limit, "limit", ""))
        detail = exc.detail if isinstance(exc.detail, str) else ""
        message = detail if detail and detail != limit_text else DEFAULT_RATE_LIMIT_MESSAGE
        return JSONResponse(
            status_code=429,
            content={
                "code": "RATE_LIMITED",
                "message": message,
                "details": None,
            },
        )

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message, "details": exc.details},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": "HTTP_ERROR", "message": str(exc.detail), "details": None},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "details": jsonable_encoder(exc.errors()),
            },
        )

    app.include_router(health.router)
    app.include_router(system.router)
    app.include_router(auth_router)
    app.include_router(storage_router)
    app.include_router(users_router)
    app.include_router(user_role_router)
    app.include_router(user_status_router)
    app.include_router(card_router)
    app.include_router(card_status_router)
    app.include_router(card_type_router)
    app.include_router(transaction_router)
    app.include_router(export_router)
    app.include_router(transaction_type_router)
    app.include_router(transaction_category_router)
    app.include_router(chat_router)
    app.include_router(request_router)
    app.include_router(audit_log_router)
    app.include_router(refund_approval_rule_router)
    app.include_router(nexus_funding_router)
    app.include_router(recurring_payment_router)
    app.include_router(wallet_router)
    app.include_router(fx_router)
    app.include_router(contact_router)
    app.include_router(family_link_router)
    app.include_router(family_allowance_router)
    app.include_router(family_spending_limit_router)

    # coalesce + single-instance so a burst of reloads (uvicorn --reload) can't
    # stack overlapping syncs on top of each other.
    scheduler = BackgroundScheduler(
        job_defaults={"coalesce": True, "max_instances": 1}
    )
    scheduler.add_job(_run_knowledge_sync, "interval", hours=1, id="knowledge_sync")
    # Run an initial sync shortly after boot on the scheduler's own thread rather
    # than inline here — calling it inline blocks app startup (and, under uvicorn
    # --reload, re-runs the full embed loop on every code change), which prevents
    # the server from binding and makes the app look "stuck syncing".
    scheduler.add_job(
        _run_knowledge_sync,
        "date",
        run_date=datetime.now() + timedelta(seconds=5),
        id="knowledge_sync_startup",
    )
    scheduler.start()

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    s = get_settings()
    kwargs: dict = {"host": s.host, "port": s.port}
    if s.reload:
        kwargs["reload"] = True
    if s.forwarded_allow_ips is not None:
        kwargs["proxy_headers"] = True
        kwargs["forwarded_allow_ips"] = s.forwarded_allow_ips
    uvicorn.run("main:app", **kwargs)
