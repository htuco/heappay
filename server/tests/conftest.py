import os

# Keep background processor off during tests (TestClient starts app lifespan).
os.environ.setdefault("TX_PROCESSOR_SCHEDULER_ENABLED", "false")

import pytest

from ratelimit import limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """The slowapi limiter store is process-global; clear it before each test so
    one test's request volume can't trip another test's auth routes."""
    limiter.reset()
    yield
