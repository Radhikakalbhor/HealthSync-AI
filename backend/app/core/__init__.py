"""Core application configuration, logging, and exception handling."""
from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.core.exceptions import (
    HealthSyncException,
    DocumentProcessingException,
    EntityNotFoundException,
    ValidationException,
    UnsupportedFileTypeException,
    FileTooLargeException,
    TesseractNotInstalledException,
    LLMNotConfiguredException,
    SupabaseNotConfiguredException,
    UnauthorizedException,
    ForbiddenException,
    register_exception_handlers,
)

__all__ = [
    "settings",
    "logger",
    "HealthSyncException",
    "DocumentProcessingException",
    "EntityNotFoundException",
    "ValidationException",
    "UnsupportedFileTypeException",
    "FileTooLargeException",
    "TesseractNotInstalledException",
    "LLMNotConfiguredException",
    "SupabaseNotConfiguredException",
    "UnauthorizedException",
    "ForbiddenException",
    "register_exception_handlers",
]
