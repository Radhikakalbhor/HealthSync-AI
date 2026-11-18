from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

EMAIL_REGEX = r"^[\w\.\+\-]+@[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,}$"


class UserRegisterRequest(BaseModel):
    """User registration payload."""
    email: str = Field(..., pattern=EMAIL_REGEX, description="Valid patient/user email address")
    password: str = Field(..., min_length=8, description="Strong password (minimum 8 characters)")
    full_name: Optional[str] = Field(None, description="Patient's legal or preferred name")


class UserLoginRequest(BaseModel):
    """User authentication login payload."""
    email: str = Field(..., pattern=EMAIL_REGEX, description="User email address")
    password: str = Field(..., description="User password")


class TokenResponse(BaseModel):
    """Returned upon successful authentication session creation."""
    access_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    refresh_token: Optional[str] = None
    user_id: str
    email: str


class UserProfileResponse(BaseModel):
    """Returned user profile metadata."""
    id: str
    email: str
    full_name: Optional[str] = None
    role: Optional[str] = Field("patient", description="User role in health system")
    clinician_approval_status: Optional[str] = Field("none", description="Clinician approval state")
    license_jurisdiction: Optional[str] = None
    created_at: Optional[datetime] = None
    confirmation_required: Optional[bool] = False
    session: Optional[TokenResponse] = None


class ClinicianApprovalRequest(BaseModel):
    """Payload to review and approve or reject a clinician account."""
    clinician_user_id: str = Field(..., description="Target clinician profile UUID")
    action: str = Field(..., pattern=r"^(approve|reject)$", description="Approval decision: 'approve' or 'reject'")
    license_number: Optional[str] = Field(None, min_length=3, description="Verified medical practice license identifier")
    license_jurisdiction: Optional[str] = Field(None, min_length=2, description="Regulatory authority / jurisdiction")
    admin_notes: Optional[str] = Field(None, description="Internal compliance approval notes")


class ShareDocumentRequest(BaseModel):
    """Payload to share a medical record with a healthcare provider or family member."""
    shared_with_email: str = Field(..., pattern=EMAIL_REGEX, description="Email of recipient")
    permission: str = Field("read", description="Access level: 'read' or 'review'")
    expires_in_days: Optional[int] = Field(7, description="Number of days until share link expires (default 7)")


class DocumentShareResponse(BaseModel):
    """Metadata for a document sharing link."""
    share_id: str
    document_id: str
    shared_with_email: str
    permission: str
    expires_at: Optional[datetime] = None
    is_revoked: bool = False
    created_at: datetime
