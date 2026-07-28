from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from settings import get_settings


class Base(DeclarativeBase):
    pass


# The namespaces every table lives in. Single source of truth: Alembic's
# autogenerate scope and the test suite both derive from this list.
SCHEMAS: tuple[str, ...] = (
    "identity",
    "money",
    "requests",
    "comms",
    "security",
    "audit",
)

# SQLite has no schema support, so tests that build their schema on it must
# translate every namespace to None. Without this, `identity.users` is
# unresolvable and table creation fails outright.
SQLITE_SCHEMA_TRANSLATE_MAP: dict[str | None, str | None] = {s: None for s in SCHEMAS}


_settings = get_settings()


def _engine_kwargs(database_url: str) -> dict:
    """Keep Supabase pooler usage within session/transaction limits."""
    kwargs: dict = {"pool_pre_ping": True}
    if "pooler.supabase.com" in database_url:
        kwargs.update(
            pool_size=2,
            max_overflow=2,
            pool_recycle=300,
            pool_timeout=30,
        )
        # Transaction pooler (port 6543) — disable server-side prepared statements.
        if ":6543" in database_url:
            kwargs["connect_args"] = {"prepare_threshold": None}
    return kwargs


engine = create_engine(
    _settings.database_url,
    **_engine_kwargs(_settings.database_url),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()