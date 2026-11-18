from typing import Any, Optional
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from backend.app.core.logger import logger


class HealthSyncException(Exception):
    """Base exception for HealthSync AI application errors."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        code: str = "INTERNAL_SERVER_ERROR",
        details: Optional[Any] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details
        super().__init__(self.message)


class DocumentProcessingException(HealthSyncException):
    """Raised when an uploaded medical document cannot be processed or parsed."""

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=422,
            code="DOCUMENT_PROCESSING_ERROR",
            details=details,
        )


class EntityNotFoundException(HealthSyncException):
    """Raised when a requested resource is not found."""

    def __init__(self, entity_name: str, entity_id: str):
        super().__init__(
            message=f"{entity_name} with ID '{entity_id}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
            code="ENTITY_NOT_FOUND",
            details={"entity": entity_name, "id": entity_id},
        )


class ValidationException(HealthSyncException):
    """Raised when incoming data fails business logic validation."""

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            details=details,
        )


class UnsupportedFileTypeException(HealthSyncException):
    """Raised when an uploaded file format is not allowed or does not match its signature."""

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            code="UNSUPPORTED_FILE_TYPE",
            details=details,
        )


class FileTooLargeException(HealthSyncException):
    """Raised when an uploaded file exceeds the configured size limit."""

    def __init__(self, max_mb: int, actual_bytes: int):
        super().__init__(
            message=f"Uploaded file exceeds the maximum allowed size of {max_mb} MB.",
            status_code=413,
            code="FILE_TOO_LARGE",
            details={"max_mb": max_mb, "actual_bytes": actual_bytes},
        )


class TesseractNotInstalledException(HealthSyncException):
    """Raised when OCR is requested on an image/scan but Tesseract OCR is not installed."""

    def __init__(self):
        msg = (
            "Tesseract OCR is not installed or not found on the system. "
            "To enable OCR on Windows: run 'winget install UB-Mannheim.TesseractOCR' "
            "or download the installer from https://github.com/UB-Mannheim/tesseract/wiki, "
            "then configure TESSERACT_CMD in your backend/.env file."
        )
        super().__init__(
            message=msg,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="OCR_DEPENDENCY_MISSING",
            details={
                "component": "tesseract",
                "installation_guide": "https://github.com/UB-Mannheim/tesseract/wiki",
                "windows_winget_command": "winget install UB-Mannheim.TesseractOCR",
            },
        )


class LLMNotConfiguredException(HealthSyncException):
    """Raised when structured AI extraction is requested but no LLM provider/key is configured."""

    def __init__(self, provider: Optional[str] = None):
        msg = (
            f"Vision LLM provider is not configured. "
            f"Please set LLM_PROVIDER ('gemini', 'openai', or 'anthropic') and LLM_API_KEY in backend/.env."
        )
        super().__init__(
            message=msg,
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            code="LLM_NOT_CONFIGURED",
            details={"provider": provider or "none", "required_env": ["LLM_PROVIDER", "LLM_API_KEY"]},
        )


class SupabaseNotConfiguredException(HealthSyncException):
    """Raised when database or storage operations are invoked but Supabase is unconfigured."""

    def __init__(self, message: Optional[str] = None):
        msg = message or (
            "Supabase credentials are not configured. "
            "Please configure SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in backend/.env."
        )
        super().__init__(
            message=msg,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="SUPABASE_NOT_CONFIGURED",
            details={"required_env": ["SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]},
        )


class UnauthorizedException(HealthSyncException):
    """Raised when authentication credentials or JWT tokens are missing or invalid."""

    def __init__(self, message: str = "Authentication credentials required."):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
            details=None,
        )


class ForbiddenException(HealthSyncException):
    """Raised when an authenticated user attempts to access a resource they do not own."""

    def __init__(self, message: str = "Access forbidden. You do not own this medical document."):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            details=None,
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Registers global exception handlers on the FastAPI application."""

    @app.exception_handler(HealthSyncException)
    async def healthsync_exception_handler(
        request: Request, exc: HealthSyncException
    ) -> JSONResponse:
        logger.warning(
            "Application error [%s]: %s | Path: %s",
            exc.code,
            exc.message,
            request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        logger.warning(
            "HTTP error %s: %s | Path: %s",
            exc.status_code,
            exc.detail,
            request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": "HTTP_ERROR",
                    "message": exc.detail,
                    "details": None,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        logger.warning(
            "Validation error on %s: %d issues",
            request.url.path,
            len(exc.errors()),
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "REQUEST_VALIDATION_ERROR",
                    "message": "Invalid request parameters.",
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.error(
            "Unhandled system exception on %s: %s",
            request.url.path,
            str(exc),
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred. Please try again later.",
                    "details": None,
                }
            },
        )
