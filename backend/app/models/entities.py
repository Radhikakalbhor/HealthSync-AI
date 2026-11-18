from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# 1. Identity, Users & Authorization
# ==============================================================================

class ProfileRecord(BaseModel):
    """Represents a public.profiles database record (Migrations 001 & 007)."""
    id: str
    email: str
    full_name: Optional[str] = None
    role: str = "patient"  # 'patient' | 'clinician' | 'admin'
    clinician_approval_status: str = "none"  # 'none' | 'pending' | 'approved' | 'rejected'
    license_number: Optional[str] = None
    license_jurisdiction: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ==============================================================================
# 2. Medical Documents & Unified Extraction
# ==============================================================================

class MedicalDocumentRecord(BaseModel):
    """Represents a public.medical_documents database record (Migrations 001, 005, 007)."""
    id: str
    user_id: str
    original_filename: str
    storage_path: str
    mime_type: str
    file_size_bytes: int
    document_type: str
    status: str
    raw_text: Optional[str] = None
    ocr_engine: Optional[str] = None
    confidence: Optional[float] = None
    confidence_method: Optional[str] = None
    requires_verification: bool = False
    fields_requiring_verification: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None
    extraction_result: Optional[Dict[str, Any]] = None
    user_reviewed: bool = False
    user_reviewed_at: Optional[datetime] = None
    clinician_verified: bool = False
    clinician_verified_at: Optional[datetime] = None
    verified_by_user_id: Optional[str] = None
    verified_by_clinician_snapshot: Optional[Dict[str, Any]] = None
    family_member_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DocumentReviewHistoryRecord(BaseModel):
    """Represents a public.document_review_history database record (Migration 007)."""
    id: str
    document_id: str
    user_id: str
    review_type: str  # 'patient_correction' | 'clinician_verification'
    reviewer_role: str  # 'patient' | 'clinician' | 'admin'
    modified_fields: Dict[str, Any] = Field(default_factory=dict)
    previous_snapshot: Dict[str, Any] = Field(default_factory=dict)
    new_snapshot: Dict[str, Any] = Field(default_factory=dict)
    review_notes: Optional[str] = None
    created_at: datetime


class DocumentShareRecord(BaseModel):
    """Represents a public.document_shares database record (Migration 001)."""
    id: str
    document_id: str
    owner_id: str
    shared_with_email: str
    shared_with_user_id: Optional[str] = None
    permission: str = "read"
    expires_at: Optional[datetime] = None
    is_revoked: bool = False
    created_at: datetime
    updated_at: datetime


# ==============================================================================
# 3. Clinical Entities (Relational Projections)
# ==============================================================================

class ExtractedPrescriptionRecord(BaseModel):
    """Represents a public.extracted_prescriptions database record (Migration 001)."""
    id: str
    document_id: str
    user_id: str
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    clinic_or_hospital: Optional[str] = None
    prescription_date: Optional[str] = None
    diagnosis_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ExtractedMedicationRecord(BaseModel):
    """Represents a public.extracted_medications database record (Migration 001)."""
    id: str
    prescription_id: str
    document_id: str
    user_id: str
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    created_at: datetime


class ExtractedLabReportRecord(BaseModel):
    """Represents a public.extracted_lab_reports database record (Migration 001)."""
    id: str
    document_id: str
    user_id: str
    patient_name: Optional[str] = None
    doctor_or_lab_name: Optional[str] = None
    report_date: Optional[str] = None
    test_category: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ExtractedLabResultRecord(BaseModel):
    """Represents a public.extracted_lab_results database record (Migration 001)."""
    id: str
    lab_report_id: str
    document_id: str
    user_id: str
    test_name: str
    measured_value: Optional[str] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    test_category: Optional[str] = None
    is_abnormal: Optional[bool] = False
    created_at: datetime


# ==============================================================================
# 4. Medication Reminders & Schedules
# ==============================================================================

class MedicationScheduleRecord(BaseModel):
    """Represents a public.medication_schedules database record (Migration 003)."""
    id: str
    user_id: str
    document_id: Optional[str] = None
    prescription_id: Optional[str] = None
    medication_name: str
    dosage: Optional[str] = None
    frequency: str = "ONCE_DAILY"
    reminder_times: List[str] = Field(default_factory=lambda: ["09:00"])
    timezone: str = "UTC"
    start_date: date
    end_date: Optional[date] = None
    instructions: Optional[str] = None
    is_active: bool = True
    user_confirmed: bool = False
    created_at: datetime
    updated_at: datetime


class MedicationReminderRecord(BaseModel):
    """Represents a public.medication_reminders database record (Migration 003)."""
    id: str
    schedule_id: str
    user_id: str
    scheduled_for: datetime
    status: str = "PENDING"  # PENDING, NOTIFIED, TAKEN, SKIPPED, MISSED
    notification_sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class MedicationLogRecord(BaseModel):
    """Represents a public.medication_logs database record (Migration 003)."""
    id: str
    schedule_id: Optional[str] = None
    reminder_id: Optional[str] = None
    user_id: str
    action: str  # TAKEN, SKIPPED, MISSED
    logged_at: datetime
    notes: Optional[str] = None
    created_at: datetime


# ==============================================================================
# 5. AI Assistant & RAG
# ==============================================================================

class DocumentChunkRecord(BaseModel):
    """Represents a public.document_chunks database record (Migration 004)."""
    id: str
    document_id: str
    user_id: str
    chunk_index: int = 0
    chunk_text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[List[float]] = None
    created_at: datetime


class ChatConversationRecord(BaseModel):
    """Represents a public.chat_conversations database record (Migration 004)."""
    id: str
    user_id: str
    title: str = "New Medical Consultation"
    created_at: datetime
    updated_at: datetime


class ChatMessageRecord(BaseModel):
    """Represents a public.chat_messages database record (Migration 004)."""
    id: str
    conversation_id: str
    user_id: str
    role: str  # 'user' | 'assistant' | 'system'
    content: str
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


# ==============================================================================
# 6. Advanced Health Intelligence (Family, Emergency, Sharing)
# ==============================================================================

class FamilyProfileRecord(BaseModel):
    """Represents a public.family_profiles database record (Migration 005)."""
    id: str
    account_owner_id: str
    full_name: str
    relationship: str = "Other"  # 'Self', 'Spouse', 'Child', 'Parent', 'Other'
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class EmergencyCardRecord(BaseModel):
    """Represents a public.emergency_cards database record (Migration 005)."""
    id: str
    user_id: str
    emergency_token: str
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    allergies: List[Any] = Field(default_factory=list)
    confirmed_medications: List[Any] = Field(default_factory=list)
    blood_group: Optional[str] = None
    critical_notes: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class SharedAccessTokenRecord(BaseModel):
    """Represents a public.shared_access_tokens database record (Migration 005)."""
    id: str
    user_id: str
    share_token: str
    document_ids: List[str] = Field(default_factory=list)
    recipient_label: Optional[str] = None
    permission_level: str = "READ_ONLY"
    expires_at: datetime
    is_revoked: bool = False
    view_count: int = 0
    last_accessed_at: Optional[datetime] = None
    created_at: datetime


# ==============================================================================
# 7. Audit Logging
# ==============================================================================

class AuditLogRecord(BaseModel):
    """Represents a public.audit_logs database record (Migration 001)."""
    id: str
    user_id: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
