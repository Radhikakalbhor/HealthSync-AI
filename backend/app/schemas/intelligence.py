from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# --- 1. Unified Medical Timeline ---

class TimelineEvent(BaseModel):
    id: str
    document_id: str
    event_date: str
    title: str
    document_type: str
    facility_or_doctor: Optional[str] = None
    summary: str
    key_items: List[str] = []
    confidence: Optional[float] = None
    needs_review: bool = False
    created_at: str


class TimelineResponse(BaseModel):
    total: int
    events: List[TimelineEvent]


# --- 2. Health Trend Analytics ---

class AnalyteDataPoint(BaseModel):
    date: str
    value: float
    unit: str
    reference_range: Optional[str] = None
    flag: Optional[str] = None  # 'NORMAL', 'HIGH', 'LOW', 'CRITICAL'
    document_id: str
    filename: str


class AnalyteTrendSeries(BaseModel):
    test_name: str
    unit: str
    reference_range: Optional[str] = None
    points: List[AnalyteDataPoint]


class HealthTrendsResponse(BaseModel):
    total_biomarkers: int
    series: List[AnalyteTrendSeries]
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None
    disclaimer: str


# --- 3. Doctor Visit Summary ---

class DoctorSummaryRequest(BaseModel):
    selected_document_ids: Optional[List[str]] = Field(None, description="Specific document IDs to include. Omit for all.")
    visit_specialty: Optional[str] = Field(None, examples=["Cardiology", "General Medicine"])
    notes: Optional[str] = Field(None, max_length=500)


class DoctorSummaryPreviewResponse(BaseModel):
    patient_name: str
    generated_at: str
    specialty: Optional[str] = None
    active_medications: List[Dict[str, Any]]
    previous_medications: List[Dict[str, Any]]
    recent_labs: List[Dict[str, Any]]
    consultations: List[Dict[str, Any]]
    document_references: List[Dict[str, str]]
    disclaimer: str


# --- 4. Secure QR Code & Sharing ---

class CreateShareTokenRequest(BaseModel):
    document_ids: List[str] = Field(..., min_length=1, description="List of document UUIDs to share")
    recipient_label: Optional[str] = Field(None, examples=["Dr. Sharma Clinic", "Second Opinion Consult"])
    expires_in_hours: int = Field(default=24, ge=1, le=168, description="Expiration time in hours (max 7 days)")


class ShareTokenResponse(BaseModel):
    share_token: str
    share_url: str
    qr_code_data_url: str
    recipient_label: Optional[str] = None
    expires_at: str
    document_count: int
    is_revoked: bool
    created_at: str


class PublicSharedDocumentView(BaseModel):
    document_id: str
    filename: str
    document_type: str
    date: Optional[str] = None
    summary: str
    extracted_data: Optional[Dict[str, Any]] = None


class PublicShareAccessResponse(BaseModel):
    share_token: str
    recipient_label: Optional[str] = None
    expires_at: str
    documents: List[PublicSharedDocumentView]
    disclaimer: str


# --- 5. Emergency Health Card ---

class EmergencyCardUpdate(BaseModel):
    emergency_contact_name: Optional[str] = Field(None, max_length=150)
    emergency_contact_phone: Optional[str] = Field(None, max_length=50)
    emergency_contact_relation: Optional[str] = Field(None, max_length=50)
    allergies: List[str] = Field(default=[], description="Allergies explicitly provided by patient")
    confirmed_medications: List[str] = Field(default=[], description="Current medications confirmed by patient")
    blood_group: Optional[str] = Field(None, max_length=10, examples=["O+", "A+", "B-"])
    critical_notes: Optional[str] = Field(None, max_length=500)
    is_active: bool = True


class EmergencyCardResponse(BaseModel):
    id: str
    user_id: str
    emergency_token: str
    emergency_url: str
    qr_code_data_url: str
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    allergies: List[str] = []
    confirmed_medications: List[str] = []
    blood_group: Optional[str] = None
    critical_notes: Optional[str] = None
    is_active: bool
    updated_at: str
    disclaimer: str


# --- 6. Family Profiles ---

class FamilyProfileCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    relationship: str = Field(default="Other", examples=["Spouse", "Child", "Parent", "Other"])
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None


class FamilyProfileResponse(BaseModel):
    id: str
    account_owner_id: str
    full_name: str
    relationship: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    created_at: str


# --- 7. Pre-Visit Doctor Briefing ---

class PreVisitBriefingRequest(BaseModel):
    doctor_specialty: str = Field(..., min_length=2, max_length=100, examples=["Cardiology", "Endocrinology"])
    primary_concern: str = Field(..., min_length=3, max_length=300, examples=["Review blood sugar and adjust medication"])
    selected_document_ids: Optional[List[str]] = None


class PreVisitBriefingResponse(BaseModel):
    specialty: str
    primary_concern: str
    recent_timeline: List[str]
    active_medications: List[str]
    relevant_lab_trends: List[str]
    suggested_questions_for_doctor: List[str]
    disclaimer: str
