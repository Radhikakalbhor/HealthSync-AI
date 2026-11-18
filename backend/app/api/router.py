from fastapi import APIRouter
from backend.app.api.routes.health import router as health_router
from backend.app.api.routes.documents import router as documents_router
from backend.app.api.routes.auth import router as auth_router
from backend.app.api.routes.reminders import router as reminders_router
from backend.app.api.routes.assistant import router as assistant_router
from backend.app.api.routes.intelligence import router as intelligence_router

api_v1_router = APIRouter()

# Register routes for API v1
api_v1_router.include_router(health_router, prefix="", tags=["Health"])
api_v1_router.include_router(auth_router, tags=["Authentication"])
api_v1_router.include_router(documents_router, prefix="/documents", tags=["Documents"])
api_v1_router.include_router(reminders_router, tags=["Medication Reminders"])
api_v1_router.include_router(assistant_router, tags=["AI Medical Records Assistant"])
api_v1_router.include_router(intelligence_router, tags=["Advanced Health Intelligence"])
