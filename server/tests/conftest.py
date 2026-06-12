import os

# Keep background processor off during tests (TestClient starts app lifespan).
os.environ.setdefault("TX_PROCESSOR_SCHEDULER_ENABLED", "false")
