from typing import Optional
from supabase import create_client, Client

from backend.app.core.config import settings
from backend.app.core.exceptions import SupabaseNotConfiguredException
from backend.app.core.logger import logger


def is_supabase_configured() -> bool:
    """Returns True if minimum Supabase credentials (URL and API Key) are provided."""
    url = (settings.SUPABASE_URL or "").strip()
    key = (settings.SUPABASE_KEY or "").strip() or (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
    return bool(url and key)


def get_supabase_client() -> Client:
    """
    Returns an initialized Supabase client using public anon key.
    Raises SupabaseNotConfiguredException if credentials are missing.
    """
    if not is_supabase_configured():
        raise SupabaseNotConfiguredException()

    try:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error("Failed to initialize Supabase client: %s", str(e))
        raise SupabaseNotConfiguredException(f"Supabase initialization error: {str(e)}")


def get_supabase_admin_client() -> Client:
    """
    Returns an initialized Supabase admin client using the service-role key.
    This bypasses RLS for trusted backend operations (e.g. audit logging, background jobs).
    Raises SupabaseNotConfiguredException if credentials are missing.
    """
    url = (settings.SUPABASE_URL or "").strip()
    admin_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip() or (settings.SUPABASE_KEY or "").strip()

    if not url or not admin_key:
        raise SupabaseNotConfiguredException(
            "Supabase service role credentials not configured in backend/.env."
        )

    try:
        return create_client(url, admin_key)
    except Exception as e:
        logger.error("Failed to initialize Supabase admin client: %s", str(e))
        raise SupabaseNotConfiguredException(f"Supabase admin initialization error: {str(e)}")
