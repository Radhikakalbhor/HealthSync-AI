from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from pydantic import BaseModel, Field

from backend.app.core.config import settings
from backend.app.core.exceptions import UnauthorizedException
from backend.app.core.logger import logger
from backend.app.core.supabase_client import is_supabase_configured, get_supabase_client

# Bearer token extractor
security_bearer = HTTPBearer(auto_error=False)


class UserTokenPayload(BaseModel):
    """Verified identity extracted from a cryptographic JWT token."""
    user_id: str = Field(..., description="Supabase auth UUID")
    email: str = Field(..., description="Verified email address")
    role: str = Field(default="authenticated", description="User role in auth schema")
    exp: Optional[int] = Field(None, description="Expiration timestamp")


def verify_jwt_token(token: str) -> UserTokenPayload:
    """
    Verifies and decodes a Supabase JWT token.
    1. If SUPABASE_JWT_SECRET is configured, performs local HMAC SHA-256 verification.
    2. Otherwise, if Supabase client is configured, delegates verification to Supabase Auth.
    3. Raises UnauthorizedException if invalid or expired.
    """
    if not token or not token.strip():
        raise UnauthorizedException("Empty authentication token provided.")

    clean_token = token.strip()

    # Synthetic demo mode token for Instant Demo Access (sandbox exploration with synthetic data)
    if settings.DEMO_MODE_ENABLED and clean_token == "demo-jwt-token-healthsync-ai":
        return UserTokenPayload(
            user_id="demo-patient-001",
            email="alex.morgan@healthsync.ai",
            role="authenticated",
        )

    # Strategy 1: Local JWT secret verification (fastest, stateless)
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                clean_token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_aud": False},
            )
            user_id = payload.get("sub")
            email = payload.get("email", "")
            if not user_id:
                raise UnauthorizedException("Malformed token: missing subject (sub).")

            return UserTokenPayload(
                user_id=user_id,
                email=email,
                role=payload.get("role", "authenticated"),
                exp=payload.get("exp"),
            )
        except jwt.ExpiredSignatureError:
            raise UnauthorizedException("Authentication token has expired. Please log in again.")
        except jwt.PyJWTError as e:
            logger.warning("JWT verification failed: %s", str(e))
            raise UnauthorizedException(f"Invalid authentication token: {str(e)}")

    # Strategy 2: Supabase Auth server verification
    if is_supabase_configured():
        try:
            client = get_supabase_client()
            user_resp = client.auth.get_user(clean_token)
            if not user_resp or not user_resp.user:
                raise UnauthorizedException("Token validation failed with Supabase Auth.")
            return UserTokenPayload(
                user_id=user_resp.user.id,
                email=user_resp.user.email or "",
                role="authenticated",
            )
        except Exception as e:
            logger.warning("Supabase auth token verification error: %s", str(e))
            raise UnauthorizedException(f"Authentication failed: {str(e)}")

    # If neither is configured, reject
    raise UnauthorizedException(
        "Authentication service is not configured. Please set SUPABASE_JWT_SECRET or SUPABASE_URL in backend/.env."
    )


async def get_current_admin_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
) -> UserTokenPayload:
    """
    FastAPI dependency that enforces administrator-only authentication.
    Requires role to be 'admin' or true 'service_role'.
    """
    user = await get_current_user(credentials)
    if user.role not in ["admin", "service_role"]:
        from backend.app.core.exceptions import ForbiddenException
        raise ForbiddenException("Administrator privilege required for this operation.")
    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
) -> UserTokenPayload:
    """
    FastAPI dependency that enforces user authentication.
    Extracts identity from Bearer token in the Authorization header.
    Never trusts user_id from query parameters or request bodies.
    """
    if not credentials or not credentials.credentials:
        raise UnauthorizedException("Missing or malformed Authorization header. Use 'Bearer <token>'.")

    return verify_jwt_token(credentials.credentials)
