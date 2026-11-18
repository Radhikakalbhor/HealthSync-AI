"""
Comprehensive test suite verifying environment separation, staging configuration isolation,
and prevention of production/staging credential mixing.
"""

import os
import pytest
from pathlib import Path
from unittest.mock import patch


def test_default_environment_loads_standard_env():
    """Verifies that default initialization targets standard .env."""
    with patch.dict(os.environ, {}, clear=True):
        from backend.app.core.config import Settings, _BACKEND_DIR
        # When no env selector is present, should target backend/.env
        settings = Settings()
        assert Path(settings.ENV_SOURCE_FILE).name == ".env"


def test_explicit_env_file_selection():
    """Verifies HEALTHSYNC_ENV_FILE points strictly to the chosen file."""
    custom_env = "backend/.env.staging.example"
    with patch.dict(os.environ, {"HEALTHSYNC_ENV_FILE": custom_env}, clear=True):
        from backend.app.core.config import Settings
        settings = Settings()
        assert ".env.staging.example" in settings.ENV_SOURCE_FILE


def test_staging_named_selection():
    """Verifies HEALTHSYNC_ENV=staging targets .env.staging."""
    with patch.dict(os.environ, {"HEALTHSYNC_ENV": "staging"}, clear=True):
        from backend.app.core.config import Settings
        settings = Settings()
        assert Path(settings.ENV_SOURCE_FILE).name == ".env.staging"


def test_staging_isolation_validation_rejects_missing_url(tmp_path):
    """Verifies staging startup aborts if SUPABASE_URL is missing or placeholder."""
    staging_file = tmp_path / ".env.staging"
    staging_file.write_text(
        'ENVIRONMENT="staging"\n'
        'SUPABASE_URL="https://<staging-project-ref>.supabase.co"\n'
        'SUPABASE_KEY="<staging-key>"\n',
        encoding="utf-8"
    )
    with patch.dict(os.environ, {"HEALTHSYNC_ENV_FILE": str(staging_file)}, clear=True):
        from backend.app.core.config import Settings
        settings = Settings()
        with pytest.raises(RuntimeError, match="STAGING CONFIGURATION ERROR"):
            settings.validate_staging_isolation()


def test_staging_isolation_validation_rejects_loading_production_env(tmp_path):
    """Verifies staging startup aborts if ENVIRONMENT=staging is loaded from root .env."""
    prod_file = tmp_path / ".env"
    prod_file.write_text(
        'ENVIRONMENT="staging"\n'
        'SUPABASE_URL="https://example.supabase.co"\n'
        'SUPABASE_KEY="valid-key"\n',
        encoding="utf-8"
    )
    with patch.dict(os.environ, {"HEALTHSYNC_ENV_FILE": str(prod_file)}, clear=True):
        from backend.app.core.config import Settings
        settings = Settings()
        with pytest.raises(RuntimeError, match="ENVIRONMENT SECURITY ABORT"):
            settings.validate_staging_isolation()


def test_staging_isolation_passes_with_valid_staging_credentials(tmp_path):
    """Verifies staging startup passes when dedicated staging credentials are provided."""
    staging_file = tmp_path / ".env.staging"
    staging_file.write_text(
        'ENVIRONMENT="staging"\n'
        'SUPABASE_URL="https://healthsync-staging-xyz.supabase.co"\n'
        'SUPABASE_KEY="real-staging-anon-token-12345"\n',
        encoding="utf-8"
    )
    with patch.dict(os.environ, {"HEALTHSYNC_ENV_FILE": str(staging_file)}, clear=True):
        from backend.app.core.config import Settings
        settings = Settings()
        # Should not raise any error
        settings.validate_staging_isolation()
        assert settings.ENVIRONMENT == "staging"
        assert "healthsync-staging-xyz" in settings.SUPABASE_URL
