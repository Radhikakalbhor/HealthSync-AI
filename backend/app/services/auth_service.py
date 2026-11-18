from datetime import datetime, timezone
from typing import Any, Dict, Optional
from backend.app.core.exceptions import (
    UnauthorizedException,
    SupabaseNotConfiguredException,
    ValidationException,
)
from backend.app.core.logger import logger
from backend.app.core.supabase_client import is_supabase_configured, get_supabase_client, get_supabase_admin_client
from backend.app.schemas.auth import TokenResponse, UserProfileResponse
from backend.app.services.audit_service import AuditService, AuditAction


class AuthService:
    """Authentication and identity service powered by Supabase Auth."""

    @classmethod
    async def register_user(
        cls, email: str, password: str, full_name: Optional[str] = None
    ) -> UserProfileResponse:
        """Registers a new user in Supabase Auth and logs an audit record."""
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        client = get_supabase_client()
        try:
            res = client.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {"data": {"full_name": full_name or ""}},
                }
            )
            if not res.user:
                raise ValidationException("User registration failed. Please verify the email format.")

            user_id = res.user.id

            # Audit record (never logs password)
            AuditService.log_event(
                action=AuditAction.USER_REGISTER,
                resource_type="auth_user",
                resource_id=user_id,
                user_id=user_id,
                metadata={"email": email},
            )

            # When Supabase Email Confirmation is ON, res.session is None
            confirmation_required = res.session is None

            session_data = None
            if res.session and getattr(res.session, "access_token", None):
                session_data = TokenResponse(
                    access_token=str(res.session.access_token),
                    token_type=str(res.session.token_type or "bearer"),
                    expires_in=int(res.session.expires_in) if res.session.expires_in else 3600,
                    refresh_token=str(res.session.refresh_token) if res.session.refresh_token else None,
                    user_id=str(res.user.id),
                    email=email,
                )

            return UserProfileResponse(
                id=user_id,
                email=email,
                full_name=full_name,
                confirmation_required=confirmation_required,
                session=session_data,
            )
        except Exception as e:
            logger.error("Supabase user registration error: %s", str(e))
            raise ValidationException(f"Registration failed: {str(e)}")

    @classmethod
    async def login_user(cls, email: str, password: str) -> TokenResponse:
        """Authenticates user with email and password, returning JWT session tokens."""
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        client = get_supabase_client()
        try:
            res = client.auth.sign_in_with_password({"email": email, "password": password})
            if not res.session or not res.user:
                raise UnauthorizedException("Invalid email or password.")

            AuditService.log_event(
                action=AuditAction.USER_LOGIN,
                resource_type="auth_user",
                resource_id=res.user.id,
                user_id=res.user.id,
            )

            user_email = email
            if res.user and hasattr(res.user, "email") and isinstance(res.user.email, str) and res.user.email:
                user_email = res.user.email

            return TokenResponse(
                access_token=str(res.session.access_token),
                token_type=str(res.session.token_type or "bearer"),
                expires_in=int(res.session.expires_in) if res.session.expires_in else 3600,
                refresh_token=str(res.session.refresh_token) if res.session.refresh_token else None,
                user_id=str(res.user.id),
                email=user_email,
            )
        except UnauthorizedException:
            raise
        except Exception as e:
            logger.warning("Login failed for '%s': %s", email, str(e))
            err_msg = str(e)
            if "email not confirmed" in err_msg.lower():
                raise UnauthorizedException(
                    "Email not confirmed. Please check your email and click the verification link to activate your account."
                )
            raise UnauthorizedException("Invalid email or password.")

    @classmethod
    async def logout_user(cls, token: str, user_id: Optional[str] = None) -> None:
        """Invalidates user session in Supabase."""
        if not is_supabase_configured():
            return

        try:
            client = get_supabase_client()
            client.auth.sign_out()
            if user_id:
                AuditService.log_event(
                    action=AuditAction.USER_LOGOUT,
                    resource_type="auth_user",
                    resource_id=user_id,
                    user_id=user_id,
                )
        except Exception as e:
            logger.warning("Supabase logout warning: %s", str(e))

    @classmethod
    def get_user_profile(cls, user_id: str) -> UserProfileResponse:
        """Retrieves user profile from public.profiles table."""
        if user_id == "demo-patient-001" or (isinstance(user_id, str) and user_id.startswith("demo-")):
            return UserProfileResponse(
                id="demo-patient-001",
                email="alex.morgan@healthsync.ai",
                full_name="Alex Morgan",
                role="patient",
                clinician_approval_status="none",
                created_at=datetime(2026, 4, 12, 0, 0, 0, tzinfo=timezone.utc),
            )

        if not is_supabase_configured():
            return UserProfileResponse(
                id=user_id,
                email=f"{user_id}@healthsync.local",
                full_name="Patient User",
            )

        admin_client = get_supabase_admin_client()
        res = admin_client.table("profiles").select("*").eq("id", user_id).execute()
        if not res.data:
            # Fallback to auth.users query
            user_auth = admin_client.auth.admin.get_user_by_id(user_id)
            if not user_auth or not user_auth.user:
                raise UnauthorizedException("User profile not found.")
            return UserProfileResponse(
                id=user_id,
                email=user_auth.user.email or "",
                full_name=user_auth.user.user_metadata.get("full_name"),
            )

        row = res.data[0]
        return UserProfileResponse(
            id=row["id"],
            email=row["email"],
            full_name=row.get("full_name"),
            created_at=row.get("created_at"),
        )
