from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.user import router as auth_router
from routers import card_status, health, system, user_statuses
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
    app.include_router(health.router)
    app.include_router(system.router)
    app.include_router(card_status.router)
    app.include_router(auth_router)
    app.include_router(user_statuses.router)
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
