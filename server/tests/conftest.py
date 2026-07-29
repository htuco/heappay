import os

# Keep background processor off during tests (TestClient starts app lifespan).
os.environ.setdefault("TX_PROCESSOR_SCHEDULER_ENABLED", "false")

import pytest
from sqlalchemy.engine import make_url

from ratelimit import limiter

# Hosts the suite is allowed to run against.
_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", ""})

# Deliberate, per-invocation opt-out. Unlike the seeder -- which has no escape
# hatch at all -- a future CI job may legitimately use a non-localhost database
# hostname, so the rail is overridable. It is intentionally not readable from
# .env: it has to be set on the command line, where it is visible.
_OVERRIDE_ENV = "HEAP_ALLOW_REMOTE_TESTS"


def pytest_configure(config: pytest.Config) -> None:
    """Refuse to run the suite against a non-local database.

    The integration tests write through DATABASE_URL -- they create, mutate and
    delete users, cards and transactions. With .env pointed at the shared
    Supabase database, `uv run pytest` rewrites real data; the 24 known failures
    are themselves foreign-key violations from tests inserting fabricated rows.

    scripts/seed_dev_data.py has refused non-local hosts for this reason. The
    test suite had no equivalent guard, which mattered a lot more once the shared
    database became a normal target for DATABASE_URL.
    """
    from settings import get_settings

    url = get_settings().database_url
    host = make_url(url).host or ""
    if host in _LOCAL_HOSTS:
        return

    if os.environ.get(_OVERRIDE_ENV) == "1":
        print(
            f"\n!! {_OVERRIDE_ENV}=1 -- running the suite against non-local host "
            f"{host!r}. This WRITES to that database.\n"
        )
        return

    raise pytest.UsageError(
        f"Refusing to run tests: DATABASE_URL points at {host!r}, which is not a "
        f"local host.\n"
        f"The suite creates, mutates and deletes rows, so this would write to a "
        f"shared database.\n"
        f"Point DATABASE_URL back at localhost (server/.env keeps the local line "
        f"commented for this), or run a one-off with:\n"
        f"    DATABASE_URL='postgresql+psycopg://postgres:...@localhost:5432/heap' uv run pytest\n"
        f"If you genuinely mean to target {host!r}, set {_OVERRIDE_ENV}=1."
    )


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """The slowapi limiter store is process-global; clear it before each test so
    one test's request volume can't trip another test's auth routes."""
    limiter.reset()
    yield
