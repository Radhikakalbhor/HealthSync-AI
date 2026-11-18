from fastapi import APIRouter, Body, Depends, Header, status
from typing import Optional

from backend.app.core.auth import get_current_user, get_current_admin_user, UserTokenPayload
from backend.app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserProfileResponse,
    ClinicianApprovalRequest,
)
from backend.app.services.auth_service import AuthService
from backend.app.services.audit_service import AuditService, AuditAction

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New User",
    description="Registers a new patient account using Supabase Auth.",
)
async def register(payload: UserRegisterRequest) -> UserProfileResponse:
    """Creates a new user account."""
    return await AuthService.register_user(
        email=str(payload.email),
        password=payload.password,
        full_name=payload.full_name,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticates credentials and returns a JWT session access token.",
)
async def login(payload: UserLoginRequest) -> TokenResponse:
    """Logs in and returns bearer token."""
    return await AuthService.login_user(
        email=str(payload.email),
        password=payload.password,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="User Logout",
    description="Logs out the current session.",
)
async def logout(
    authorization: Optional[str] = Header(None),
    current_user: Optional[UserTokenPayload] = Depends(get_current_user),
) -> dict:
    """Invalidates the active session."""
    token = authorization.replace("Bearer ", "").strip() if authorization else ""
    user_id = current_user.user_id if current_user else None
    await AuthService.logout_user(token=token, user_id=user_id)
    return {"status": "success", "message": "Successfully logged out."}


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Current User Profile",
    description="Returns the profile information of the verified authenticated user.",
)
def get_me(
    current_user: UserTokenPayload = Depends(get_current_user),
) -> UserProfileResponse:
    """Returns profile for currently authenticated user."""
    return AuthService.get_user_profile(current_user.user_id)


@router.post(
    "/admin/clinicians/approve",
    status_code=status.HTTP_200_OK,
    summary="Admin Review & Clinician Credential Approval",
    description=(
        "Restricted to verified system administrators. Validates medical license credentials "
        "and sets clinician approval status without permitting self-promotion."
    ),
)
async def approve_clinician(
    payload: ClinicianApprovalRequest = Body(...),
    admin_user: UserTokenPayload = Depends(get_current_admin_user),
) -> dict:
    """Processes clinician approval or rejection decision."""
    from backend.app.core.supabase_client import get_supabase_admin_client, is_supabase_configured
    from backend.app.core.exceptions import ValidationException, EntityNotFoundException
    from datetime import datetime, timezone

    # Self-approval is strictly forbidden
    if payload.clinician_user_id == admin_user.user_id:
        raise ValidationException("Administrators and clinicians cannot approve their own professional accounts.")

    decision_status = "approved" if payload.action == "approve" else "rejected"

    if payload.action == "approve" and not payload.license_number:
        raise ValidationException("A valid professional license number is mandatory to approve a clinician.")

    now_iso = datetime.now(timezone.utc).isoformat()

    if is_supabase_configured():
        client = get_supabase_admin_client()
        profile_res = client.table("profiles").select("*").eq("id", payload.clinician_user_id).execute()
        if not profile_res.data:
            raise EntityNotFoundException("User Profile", payload.clinician_user_id)

        update_payload = {
            "role": "clinician" if payload.action == "approve" else "patient",
            "clinician_approval_status": decision_status,
            "license_number": payload.license_number if payload.action == "approve" else None,
            "license_jurisdiction": payload.license_jurisdiction if payload.action == "approve" else None,
            "updated_at": now_iso,
        }
        client.table("profiles").update(update_payload).eq("id", payload.clinician_user_id).execute()

    AuditService.log_event(
        action=AuditAction.SECURITY_EVENT,
        resource_type="profile_clinician_approval",
        resource_id=payload.clinician_user_id,
        user_id=admin_user.user_id,
        metadata={
            "decision": decision_status,
            "license_jurisdiction": payload.license_jurisdiction,
            "admin_notes": payload.admin_notes,
        },
    )

    return {
        "status": "success",
        "clinician_user_id": payload.clinician_user_id,
        "approval_status": decision_status,
        "action_taken_by": admin_user.user_id,
        "timestamp": now_iso,
    }
