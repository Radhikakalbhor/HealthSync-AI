from typing import Any, Dict, Optional
from backend.app.core.logger import logger
from backend.app.core.supabase_client import is_supabase_configured, get_supabase_admin_client


class AuditAction:
    USER_REGISTER = "USER_REGISTER"
    USER_LOGIN = "USER_LOGIN"
    USER_LOGOUT = "USER_LOGOUT"
    DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD"
    DOCUMENT_EXTRACT = "DOCUMENT_EXTRACT"
    DOCUMENT_REVIEW = "DOCUMENT_REVIEW"
    DOCUMENT_DELETE = "DOCUMENT_DELETE"
    REVIEW_COMPLETE = "REVIEW_COMPLETE"
    SHARE_CREATE = "SHARE_CREATE"
    SHARE_REVOKE = "SHARE_REVOKE"
    REMINDER_CREATE = "REMINDER_CREATE"
    REMINDER_LOG = "REMINDER_LOG"
    ASSISTANT_QUERY = "ASSISTANT_QUERY"


# Sensitive keys that must NEVER appear in audit log metadata
BLOCKED_METADATA_KEYS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "secret",
    "raw_text",
    "medication",
    "dosage",
    "diagnosis",
    "lab_value",
}


class AuditService:
    """
    Append-only audit logging service for compliance and security traceability.
    Enforces HIPAA privacy safeguards: never logs raw PHI, tokens, or passwords.
    """

    @classmethod
    def sanitize_metadata(cls, meta: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Strips passwords, tokens, API keys, and sensitive medical text from audit metadata."""
        if not meta:
            return {}
        clean = {}
        for k, v in meta.items():
            if k.lower() in BLOCKED_METADATA_KEYS or "token" in k.lower() or "secret" in k.lower():
                continue
            # Also truncate long string values
            if isinstance(v, str) and len(v) > 150:
                clean[k] = v[:150] + "..."
            else:
                clean[k] = v
        return clean

    @classmethod
    def log_event(
        cls,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Records an audit event in the database (if configured) and application log.
        """
        clean_meta = cls.sanitize_metadata(metadata)

        # Standardized safe operational log
        logger.info(
            "AUDIT | action=%s | resource=%s:%s | user=%s",
            action,
            resource_type,
            resource_id or "none",
            user_id or "anonymous",
        )

        # Persist to Supabase public.audit_logs if configured (skip for isolated demo users)
        is_demo = bool(user_id and (user_id == "demo-patient-001" or str(user_id).startswith("demo-")))
        if is_supabase_configured() and not is_demo:
            try:
                admin_client = get_supabase_admin_client()
                admin_client.table("audit_logs").insert(
                    {
                        "user_id": user_id,
                        "action": action,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "ip_address": ip_address,
                        "user_agent": user_agent,
                        "metadata": clean_meta,
                    }
                ).execute()
            except Exception as e:
                # Never crash the primary medical operation if audit write encounters a transient error
                logger.warning("Failed to record audit log in Supabase: %s", str(e))
