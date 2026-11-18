from datetime import datetime
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema representing the health check response."""

    status: str = Field(..., description="Operational status of the service", examples=["healthy"])
    version: str = Field(..., description="Application version", examples=["0.1.0"])
    environment: str = Field(..., description="Runtime environment", examples=["development"])
    timestamp: datetime = Field(..., description="Current server UTC timestamp")
    uptime_seconds: float = Field(..., description="Seconds since application startup")
