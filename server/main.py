from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from exceptions import AppException
from routes import health, system
from routes.card.card import router as card_router
from routes.card.card_status import router as card_status_router
from routes.card.card_type import router as card_type_router
from routes.storage.images import router as storage_router
from routes.transaction.transaction import router as transaction_router
from routes.transaction.transaction_type import router as transaction_type_router
from routes.request.request import router as request_router
from routes.user.auth import router as auth_router
from routes.user.user import router as users_router
from routes.user.user_role import router as user_role_router
from routes.user.user_status import router as user_status_router
from settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI()
    cors_kwargs: dict = {
        "allow_origins": settings.cors_origin_list,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    # Vite may use 5173, 5174, etc. — regex covers local ports without listing each one.
    cors_kwargs["allow_origin_regex"] = r"http://(localhost|127\.0\.0\.1)(:\d+)?"
    app.add_middleware(CORSMiddleware, **cors_kwargs)

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
    app.include_router(transaction_type_router)
    app.include_router(request_router)
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
