"""
Intelligence and Advanced Health Services API Routes.
Provides endpoints for unified medical timeline, biomarker analytics trends,
doctor visit summaries with PDF generation, secure QR document sharing,
emergency health cards, family member profiles, and doctor pre-visit briefings.
"""

from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, Response, status

from backend.app.core.auth import get_current_user, UserTokenPayload
from backend.app.schemas.intelligence import (
    CreateShareTokenRequest,
    DoctorSummaryPreviewResponse,
    DoctorSummaryRequest,
    EmergencyCardResponse,
    EmergencyCardUpdate,
    FamilyProfileCreate,
    FamilyProfileResponse,
    HealthTrendsResponse,
    PreVisitBriefingRequest,
    PreVisitBriefingResponse,
    PublicShareAccessResponse,
    ShareTokenResponse,
    TimelineResponse,
)
from backend.app.services.intelligence_service import IntelligenceService

router = APIRouter(tags=["Advanced Health Intelligence"])


# =============================================================================
# 1. UNIFIED MEDICAL TIMELINE
# =============================================================================

@router.get(
    "/timeline",
    response_model=TimelineResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Unified Medical Timeline",
    description="Returns an aggregated chronological medical timeline from uploaded prescriptions, labs, imaging, and consultations.",
)
def get_timeline(
    category: Optional[str] = Query(None, description="Filter by category (prescription, blood_test, imaging_report, etc.)"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Keyword search across titles, summaries, and doctors"),
    current_user: UserTokenPayload = Depends(get_current_user),
) -> TimelineResponse:
    """Retrieves chronological medical records for the authenticated patient."""
    return IntelligenceService.get_timeline(
        user_id=current_user.user_id,
        category=category,
        start_date=str(start_date) if start_date else None,
        end_date=str(end_date) if end_date else None,
        search=search,
    )


# =============================================================================
# 2. HEALTH TREND ANALYTICS
# =============================================================================

@router.get(
    "/analytics/trends",
    response_model=HealthTrendsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Biomarker Health Trends",
    description="Returns longitudinal lab test data points grouped strictly by compatible units for safe Recharts visualization.",
)
def get_health_trends(
    test_name: Optional[str] = Query(None, description="Filter by specific biomarker (e.g. 'HbA1c', 'Glucose', 'Hemoglobin')"),
    current_user: UserTokenPayload = Depends(get_current_user),
) -> HealthTrendsResponse:
    """Retrieves analyte trend series ensuring unit compatibility."""
    return IntelligenceService.get_health_trends(
        user_id=current_user.user_id,
        biomarker_filter=test_name,
    )


# =============================================================================
# 3. DOCTOR VISIT SUMMARY & PDF EXPORT
# =============================================================================

@router.post(
    "/summary/preview",
    response_model=DoctorSummaryPreviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Preview Doctor Visit Summary",
    description="Returns patient-controlled structured medical summary preview distinguishing active vs previous medications and recent labs.",
)
def preview_doctor_summary(
    payload: DoctorSummaryRequest,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> DoctorSummaryPreviewResponse:
    """Generates a structured doctor visit summary preview."""
    return IntelligenceService.generate_doctor_summary_preview(
        user_id=current_user.user_id,
        req=payload,
    )


@router.post(
    "/summary/generate-pdf",
    status_code=status.HTTP_200_OK,
    summary="Download Doctor Visit Summary PDF",
    description="Generates a formatted downloadable PDF medical summary report.",
)
def generate_doctor_summary_pdf(
    payload: DoctorSummaryRequest,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> Response:
    """Builds and returns a binary PDF document using PyMuPDF."""
    pdf_bytes = IntelligenceService.generate_doctor_summary_pdf(
        user_id=current_user.user_id,
        req=payload,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="healthsync_doctor_summary.pdf"',
            "Content-Type": "application/pdf",
        },
    )


# =============================================================================
# 4. TIME-LIMITED SECURE QR CODE SHARING
# =============================================================================

@router.post(
    "/shares",
    response_model=ShareTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Secure Share Token with QR Code",
    description="Creates a time-limited cryptographically secure share link with QR code data URL.",
)
def create_share_token(
    payload: CreateShareTokenRequest,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> ShareTokenResponse:
    """Generates a secure, expiring share token."""
    return IntelligenceService.create_share_token(
        user_id=current_user.user_id,
        req=payload,
    )


@router.get(
    "/shares",
    response_model=List[ShareTokenResponse],
    status_code=status.HTTP_200_OK,
    summary="List Active Share Links",
    description="Lists all share links created by the current user.",
)
def list_user_shares(
    current_user: UserTokenPayload = Depends(get_current_user),
) -> List[ShareTokenResponse]:
    """Lists the user's active share links."""
    return IntelligenceService.list_user_shares(user_id=current_user.user_id)


@router.delete(
    "/shares/{token_or_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke Document Share Link",
    description="Immediately revokes a document share link so it can no longer be accessed.",
)
def revoke_share(
    token_or_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    """Revokes a share token immediately."""
    IntelligenceService.revoke_share_token(user_id=current_user.user_id, share_token=token_or_id)
    return {"success": True, "message": "Share link has been revoked."}


@router.get(
    "/shares/public/{token}",
    response_model=PublicShareAccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Public Read-Only Shared Document Access",
    description="Public access endpoint for authorized shared records. Does not require login; validated strictly by unguessable time-limited token.",
)
def get_public_shared_documents(token: str) -> PublicShareAccessResponse:
    """Allows read-only view of patient-permitted medical records via secure token."""
    return IntelligenceService.get_public_share(share_token=token)


# =============================================================================
# 5. EMERGENCY HEALTH CARD
# =============================================================================

@router.get(
    "/emergency",
    response_model=EmergencyCardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Emergency Health Card",
    description="Fetches current user's emergency health card profile with QR code.",
)
def get_emergency_card(
    current_user: UserTokenPayload = Depends(get_current_user),
) -> EmergencyCardResponse:
    """Returns patient's emergency card."""
    return IntelligenceService.get_or_create_emergency_card(user_id=current_user.user_id)


@router.put(
    "/emergency",
    response_model=EmergencyCardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Emergency Health Card",
    description="Configures emergency contacts, allergies, blood group, and critical clinical notes.",
)
def update_emergency_card(
    payload: EmergencyCardUpdate,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> EmergencyCardResponse:
    """Updates emergency card settings."""
    return IntelligenceService.update_emergency_card(
        user_id=current_user.user_id,
        req=payload,
    )


@router.post(
    "/emergency/rotate-token",
    response_model=EmergencyCardResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate Emergency Token",
    description="Generates a new secure emergency token, immediately revoking old QR codes.",
)
def rotate_emergency_token(
    current_user: UserTokenPayload = Depends(get_current_user),
) -> EmergencyCardResponse:
    """Rotates patient's emergency card token."""
    return IntelligenceService.rotate_emergency_token(user_id=current_user.user_id)



@router.get(
    "/emergency/public/{token}",
    response_model=EmergencyCardResponse,
    status_code=status.HTTP_200_OK,
    summary="Public Emergency Health Card View",
    description="Emergency responders view for vital info, contacts, allergies, and critical notes.",
)
def get_public_emergency_card(token: str) -> EmergencyCardResponse:
    """Public read-only emergency card accessed via physical/digital QR badge."""
    return IntelligenceService.get_public_emergency_card(emergency_token=token)


# =============================================================================
# 6. FAMILY PROFILES
# =============================================================================

@router.post(
    "/family",
    response_model=FamilyProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Family Profile",
    description="Adds a dependent or family member profile (e.g. child, parent, spouse) under the primary account.",
)
def create_family_profile(
    payload: FamilyProfileCreate,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> FamilyProfileResponse:
    """Creates a family profile for managing family health documents."""
    return IntelligenceService.create_family_profile(
        account_owner_id=current_user.user_id,
        req=payload,
    )


@router.get(
    "/family",
    response_model=List[FamilyProfileResponse],
    status_code=status.HTTP_200_OK,
    summary="List Family Profiles",
    description="Returns all family member profiles created by the primary account.",
)
def list_family_profiles(
    current_user: UserTokenPayload = Depends(get_current_user),
) -> List[FamilyProfileResponse]:
    """Lists all family profiles."""
    return IntelligenceService.list_family_profiles(account_owner_id=current_user.user_id)


@router.delete(
    "/family/{profile_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Family Profile",
    description="Removes a family profile.",
)
def delete_family_profile(
    profile_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    """Deletes family profile."""
    IntelligenceService.delete_family_profile(
        account_owner_id=current_user.user_id,
        profile_id=profile_id,
    )
    return {"success": True, "message": "Family member profile deleted."}


# =============================================================================
# 7. PRE-VISIT DOCTOR BRIEFING
# =============================================================================

@router.post(
    "/briefing/generate",
    response_model=PreVisitBriefingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Pre-Visit Doctor Briefing",
    description="Synthesizes relevant patient history and generates neutral, empowering suggested questions for doctor consultations.",
)
def generate_doctor_briefing(
    payload: PreVisitBriefingRequest,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> PreVisitBriefingResponse:
    """Generates structured pre-visit briefing for an upcoming medical consultation."""
    return IntelligenceService.generate_pre_visit_briefing(
        user_id=current_user.user_id,
        req=payload,
    )
