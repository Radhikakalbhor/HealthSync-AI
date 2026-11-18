import os
from pathlib import Path
from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


def get_target_env_file() -> Path:
    """Dynamically resolves the environment configuration file."""
    explicit_env_file = os.getenv("HEALTHSYNC_ENV_FILE")
    target_env = os.getenv("APP_ENV", os.getenv("HEALTHSYNC_ENV", "")).lower().strip()

    if explicit_env_file:
        resolved_env_path = Path(explicit_env_file)
        if not resolved_env_path.is_absolute():
            resolved_env_path = _BACKEND_DIR / explicit_env_file
        return resolved_env_path
    elif target_env == "staging":
        return _BACKEND_DIR / ".env.staging"
    return _BACKEND_DIR / ".env"


_ENV_FILE = get_target_env_file()


class Settings(BaseSettings):
    """
    Application configuration settings loaded from environment variables or .env file.
    """
    PROJECT_NAME: str = "HealthSync AI"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = (
        "AI-powered Personal Medical Record and Prescription Manager. "
        "Provides organization, retrieval, and explanation of existing medical records. "
        "Does NOT provide medical diagnosis or treatment prescriptions."
    )
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_V1_STR: str = "/api/v1"
    DEMO_MODE_ENABLED: bool = False

    # Medical Disclaimer
    MEDICAL_DISCLAIMER: str = (
        "HealthSync AI organizes, retrieves, and explains information from existing medical records. "
        "It NEVER diagnoses diseases, recommends treatments, or prescribes medications. "
        "Always consult a licensed healthcare professional for clinical decisions."
    )

    # CORS configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    FRONTEND_URL: Optional[str] = None

    # File uploads & storage
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".png", ".jpg", ".jpeg"]
    ALLOWED_MIME_TYPES: List[str] = [
        "application/pdf",
        "image/png",
        "image/jpeg",
    ]

    # Tesseract OCR settings
    TESSERACT_CMD: Optional[str] = None

    # Supabase Database, Auth & Storage Settings
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""  # Anon / public key
    SUPABASE_SERVICE_ROLE_KEY: str = ""  # Service role key (trusted backend only)
    SUPABASE_JWT_SECRET: str = ""  # Secret for JWT validation
    SUPABASE_STORAGE_BUCKET: str = "medical-documents"
    JWT_ALGORITHM: str = "HS256"

    # Vision LLM Integration Settings
    LLM_PROVIDER: Optional[str] = None  # e.g., "gemini", "openai", "anthropic"
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gemini-1.5-flash"
    LLM_MAX_RETRIES: int = 3
    LLM_TIMEOUT_SECONDS: int = 30

    # Native PostgreSQL Direct Connection (Opt-in local / dedicated DB adapter)
    HEALTHSYNC_DATABASE_URL: Optional[str] = None
    DB_POOL_MIN_SIZE: int = 1
    DB_POOL_MAX_SIZE: int = 10
    DB_POOL_TIMEOUT: float = 10.0

    # Staging & Environment Isolation Safety
    ENV_SOURCE_FILE: Optional[str] = None

    def __init__(self, **values):
        super().__init__(**values)
        if not self.ENV_SOURCE_FILE:
            self.ENV_SOURCE_FILE = str(get_target_env_file())

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        from pydantic_settings import DotEnvSettingsSource
        dynamic_env_file = get_target_env_file()
        return (
            init_settings,
            env_settings,
            DotEnvSettingsSource(settings_cls, env_file=dynamic_env_file, env_file_encoding="utf-8"),
            file_secret_settings,
        )

    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    @field_validator("TESSERACT_CMD", mode="before")
    @classmethod
    def sanitize_tesseract_cmd(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        # Handle accidental unescaped tab character "\tesseract" from .env
        if "\t" in v:
            v = v.replace("\t", "\\t")
        cleaned = v.strip("\"' ")
        return cleaned if cleaned else None


    def get_cors_origins(self) -> List[str]:
        """Gathers CORS origins including local dev and optional production FRONTEND_URL or VERCEL_URL."""
        origins = list(self.CORS_ORIGINS) if isinstance(self.CORS_ORIGINS, list) else []
        if self.FRONTEND_URL:
            clean_url = self.FRONTEND_URL.strip()
            if clean_url and clean_url not in origins:
                origins.append(clean_url)
        vercel_url = os.getenv("VERCEL_URL")
        if vercel_url:
            clean_vercel = vercel_url.strip()
            if not clean_vercel.startswith("http"):
                clean_vercel = f"https://{clean_vercel}"
            if clean_vercel not in origins:
                origins.append(clean_vercel)
        return origins

    def validate_staging_isolation(self) -> None:
        """
        Validates environment boundary rules:
        1. If running in staging, refuses to run if the environment file points to .env
           or if Supabase credentials contain placeholder markers or match production patterns.
        2. Raises RuntimeError on any boundary violation to abort startup safely.
        """
        if self.ENVIRONMENT == "staging":
            if Path(self.ENV_SOURCE_FILE).name == ".env":
                raise RuntimeError(
                    "ENVIRONMENT SECURITY ABORT: Application set to ENVIRONMENT='staging' "
                    "but loaded root production/development .env instead of .env.staging! "
                    "Set HEALTHSYNC_ENV_FILE=backend/.env.staging or HEALTHSYNC_ENV=staging."
                )
            if not self.SUPABASE_URL or "<staging" in self.SUPABASE_URL:
                raise RuntimeError(
                    "STAGING CONFIGURATION ERROR: Staging SUPABASE_URL is unconfigured or "
                    "contains placeholder values. Please populate backend/.env.staging with "
                    "your dedicated staging Supabase project URL."
                )
            if not self.SUPABASE_KEY or "<staging" in self.SUPABASE_KEY:
                raise RuntimeError(
                    "STAGING CONFIGURATION ERROR: Staging SUPABASE_KEY is unconfigured or "
                    "contains placeholder values."
                )


settings = Settings()
settings.validate_staging_isolation()
