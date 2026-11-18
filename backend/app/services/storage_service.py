from pathlib import Path
from typing import Optional
from backend.app.core.config import settings
from backend.app.core.exceptions import (
    ForbiddenException,
    DocumentProcessingException,
    SupabaseNotConfiguredException,
)
from backend.app.core.logger import logger
from backend.app.core.supabase_client import is_supabase_configured, get_supabase_admin_client


class StorageService:
    """
    Secure medical document storage using private Supabase Storage buckets.
    Enforces user isolation paths: {user_id}/{document_id}/{filename}.
    Never creates or allows public access.
    """

    BUCKET_NAME = settings.SUPABASE_STORAGE_BUCKET

    @classmethod
    def get_storage_path(cls, user_id: str, document_id: str, filename: str) -> str:
        """Constructs a deterministic, user-isolated storage path."""
        clean_name = Path(filename).name
        return f"{user_id}/{document_id}/{clean_name}"

    @classmethod
    def verify_ownership(cls, storage_path: str, user_id: str) -> None:
        """Ensures that the requested storage path strictly belongs to the user."""
        expected_prefix = f"{user_id}/"
        if not storage_path.startswith(expected_prefix):
            logger.warning(
                "Storage access forbidden: user '%s' attempted to access '%s'",
                user_id,
                storage_path,
            )
            raise ForbiddenException("Access denied to storage path belonging to another user.")

    @classmethod
    async def upload_file(
        cls,
        user_id: str,
        document_id: str,
        filename: str,
        file_bytes: bytes,
        mime_type: str,
    ) -> str:
        """
        Uploads file bytes to the private Supabase storage bucket under the user's isolated prefix.
        Returns the canonical storage path.
        """
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        storage_path = cls.get_storage_path(user_id, document_id, filename)
        client = get_supabase_admin_client()

        try:
            # Upload to private bucket
            client.storage.from_(cls.BUCKET_NAME).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": mime_type, "upsert": "true"},
            )
            return storage_path
        except Exception as e:
            logger.error("Supabase Storage upload error: %s", str(e))
            raise DocumentProcessingException(f"Failed to securely store document: {str(e)}")

    @classmethod
    def create_signed_url(
        cls, storage_path: str, user_id: str, expires_in_seconds: int = 3600
    ) -> str:
        """
        Generates a temporary, cryptographically signed URL to view/download a private document.
        Enforces user ownership.
        """
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        cls.verify_ownership(storage_path, user_id)
        client = get_supabase_admin_client()

        try:
            res = client.storage.from_(cls.BUCKET_NAME).create_signed_url(
                path=storage_path,
                expires_in=expires_in_seconds,
            )
            if isinstance(res, dict) and "signedURL" in res:
                return res["signedURL"]
            elif hasattr(res, "signed_url"):
                return res.signed_url
            elif isinstance(res, str):
                return res
            raise DocumentProcessingException("Could not generate signed download URL.")
        except Exception as e:
            logger.error("Signed URL creation error: %s", str(e))
            raise DocumentProcessingException(f"Failed to generate secure URL: {str(e)}")

    @classmethod
    def download_file(cls, storage_path: str, user_id: str) -> bytes:
        """Downloads private binary content from Supabase Storage. Enforces user ownership."""
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        cls.verify_ownership(storage_path, user_id)
        client = get_supabase_admin_client()

        try:
            return client.storage.from_(cls.BUCKET_NAME).download(storage_path)
        except Exception as e:
            logger.error("Supabase Storage download error: %s", str(e))
            raise DocumentProcessingException(f"Failed to retrieve document: {str(e)}")

    @classmethod
    def delete_file(cls, storage_path: str, user_id: str) -> None:
        """Deletes a file from Supabase Storage after ownership check."""
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        cls.verify_ownership(storage_path, user_id)
        client = get_supabase_admin_client()

        try:
            client.storage.from_(cls.BUCKET_NAME).remove([storage_path])
        except Exception as e:
            logger.warning("Supabase Storage delete warning: %s", str(e))
