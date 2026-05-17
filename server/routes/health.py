from fastapi import APIRouter

from services import health as health_service

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    """Load balancer / readiness probe without hitting the database."""
    return health_service.health_status()
