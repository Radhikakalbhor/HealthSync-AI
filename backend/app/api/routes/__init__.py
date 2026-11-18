"""API route handlers."""
from backend.app.api.routes.health import router as health_router
from backend.app.api.routes.documents import router as documents_router
from backend.app.api.routes.auth import router as auth_router

__all__ = ["health_router", "documents_router", "auth_router"]
