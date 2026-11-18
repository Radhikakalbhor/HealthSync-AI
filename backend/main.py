from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.core.exceptions import register_exception_handlers
from backend.app.api.router import api_v1_router
from backend.app.api.routes.health import router as root_health_router
from backend.app.utils.file_handler import ensure_upload_dir


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown routines."""
    logger.info("Initializing %s v%s in %s mode...", settings.PROJECT_NAME, settings.VERSION, settings.ENVIRONMENT)
    # Ensure storage directories exist
    upload_path = ensure_upload_dir()
    logger.info("Local storage directory verified at: %s", upload_path.resolve())
    yield
    logger.info("Shutting down %s...", settings.PROJECT_NAME)


def create_application() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=settings.DESCRIPTION,
        openapi_url="/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS configuration for frontend integration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register custom exception handlers
    register_exception_handlers(app)

    # Top-level health check endpoint: GET /health
    app.include_router(root_health_router, prefix="", tags=["Health"])

    # Versioned API routes: /api/v1/...
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    @app.get(
        "/",
        status_code=status.HTTP_200_OK,
        tags=["Root"],
        summary="Root API Info",
    )
    async def root():
        """Root API metadata and documentation links."""
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "status": "online",
            "docs": "/docs",
            "health": "/health",
            "api_v1": settings.API_V1_STR,
            "disclaimer": "HealthSync AI is for medical record organization and personal health reference. It does not provide medical diagnoses or prescriptions.",
        }

    return app


app = create_application()

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
