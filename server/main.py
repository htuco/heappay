from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from exceptions import AppException
from routers.user import router as auth_router
from routers import card, card_status, health, system
from settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
                "details": exc.errors(),
            },
        )

    app.include_router(health.router)
    app.include_router(system.router)
    app.include_router(card.router)
    app.include_router(card_status.router)
    app.include_router(auth_router)
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