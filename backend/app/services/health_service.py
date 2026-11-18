import time
from datetime import datetime, timezone
from backend.app.core.config import settings
from backend.app.schemas.health import HealthResponse

# Track process startup time
_START_TIME = time.time()


class HealthService:
    """Service responsible for system health and diagnostics."""

    @staticmethod
    def get_health_status() -> HealthResponse:
        """Returns the current operational status of the service."""
        uptime = round(time.time() - _START_TIME, 2)
        return HealthResponse(
            status="healthy",
            version=settings.VERSION,
            environment=settings.ENVIRONMENT,
            timestamp=datetime.now(timezone.utc),
            uptime_seconds=uptime,
        )
