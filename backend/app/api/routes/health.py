from fastapi import APIRouter, status
from backend.app.schemas.health import HealthResponse
from backend.app.services.health_service import HealthService

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health Check",
    description="Returns service operational status, version, and server timestamp.",
)
async def check_health() -> HealthResponse:
    """Returns application health status."""
    return HealthService.get_health_status()
