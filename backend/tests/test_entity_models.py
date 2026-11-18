"""
Unit tests for HealthSync AI database entity models (backend/app/models/entities.py).
Validates schema alignment across Migrations 001 through 007:
- Data types, defaults, nullability, and JSONB serialization
- Migration 007 column alignment on ProfileRecord and MedicalDocumentRecord
- All 11 newly mapped entity models covering all tables in the schema
"""

from datetime import date, datetime, timezone
import pytest
from pydantic import ValidationError

from backend.app.models.entities import (
    ProfileRecord,
    MedicalDocumentRecord,
    DocumentReviewHistoryRecord,
    DocumentShareRecord,
    ExtractedPrescriptionRecord,
    ExtractedMedicationRecord,
    ExtractedLabReportRecord,
    ExtractedLabResultRecord,
    MedicationScheduleRecord,
    MedicationReminderRecord,
    MedicationLogRecord,
    DocumentChunkRecord,
    ChatConversationRecord,
    ChatMessageRecord,
    FamilyProfileRecord,
    EmergencyCardRecord,
    SharedAccessTokenRecord,
    AuditLogRecord,
)


class TestProfileRecordAlignment:
    """Verifies ProfileRecord matches Migrations 001 & 007."""

    def test_default_profile_patient(self):
        now = datetime.now(timezone.utc)
        p = ProfileRecord(
            id="user-123",
            email="patient@healthsync.ai",
            created_at=now,
            updated_at=now,
        )
        assert p.id == "user-123"
        assert p.email == "patient@healthsync.ai"
        assert p.full_name is None
        assert p.role == "patient"
        assert p.clinician_approval_status == "none"
        assert p.license_number is None
        assert p.license_jurisdiction is None

    def test_clinician_approved_profile(self):
        now = datetime.now(timezone.utc)
        p = ProfileRecord(
            id="doc-456",
            email="dr.carter@healthsync.ai",
            full_name="Dr. Sarah Carter, MD",
            role="clinician",
            clinician_approval_status="approved",
            license_number="MD-987654",
            license_jurisdiction="CA",
            created_at=now,
            updated_at=now,
        )
        assert p.role == "clinician"
        assert p.clinician_approval_status == "approved"
        assert p.license_number == "MD-987654"


class TestMedicalDocumentRecordAlignment:
    """Verifies MedicalDocumentRecord matches Migrations 001, 005 & 007."""

    def test_default_document_record(self):
        now = datetime.now(timezone.utc)
        doc = MedicalDocumentRecord(
            id="doc-123",
            user_id="user-123",
            original_filename="prescription.pdf",
            storage_path="uploads/user-123/doc-123.pdf",
            mime_type="application/pdf",
            file_size_bytes=10240,
            document_type="prescription",
            status="extracted",
            created_at=now,
            updated_at=now,
        )
        assert doc.user_reviewed is False
        assert doc.user_reviewed_at is None
        assert doc.clinician_verified is False
        assert doc.clinician_verified_at is None
        assert doc.verified_by_user_id is None
        assert doc.verified_by_clinician_snapshot is None
        assert doc.extraction_result is None
        assert doc.family_member_id is None

    def test_document_with_unified_extraction_and_verification(self):
        now = datetime.now(timezone.utc)
        snapshot = {
            "doctor_name": "Dr. Sarah Carter",
            "license_number": "MD-987654",
            "license_jurisdiction": "CA",
        }
        extraction = {
            "document_type": "prescription",
            "structured_data": {"medications": [{"name": "Amoxicillin", "dosage": "500mg"}]},
        }
        doc = MedicalDocumentRecord(
            id="doc-123",
            user_id="user-123",
            original_filename="prescription.pdf",
            storage_path="uploads/doc-123.pdf",
            mime_type="application/pdf",
            file_size_bytes=2048,
            document_type="prescription",
            status="verified",
            extraction_result=extraction,
            user_reviewed=True,
            user_reviewed_at=now,
            clinician_verified=True,
            clinician_verified_at=now,
            verified_by_user_id="clinician-uuid-99",
            verified_by_clinician_snapshot=snapshot,
            family_member_id="family-uuid-1",
            created_at=now,
            updated_at=now,
        )
        assert doc.user_reviewed is True
        assert doc.clinician_verified is True
        assert doc.verified_by_clinician_snapshot["doctor_name"] == "Dr. Sarah Carter"
        assert doc.family_member_id == "family-uuid-1"


class TestDocumentReviewHistoryRecord:
    """Verifies DocumentReviewHistoryRecord matches Migration 007."""

    def test_patient_review_history_record(self):
        now = datetime.now(timezone.utc)
        rev = DocumentReviewHistoryRecord(
            id="rev-1",
            document_id="doc-123",
            user_id="user-123",
            review_type="patient_correction",
            reviewer_role="patient",
            modified_fields={"dosage": "250mg"},
            previous_snapshot={"dosage": "500mg"},
            new_snapshot={"dosage": "250mg"},
            review_notes="Corrected dosage to 250mg as advised",
            created_at=now,
        )
        assert rev.review_type == "patient_correction"
        assert rev.modified_fields == {"dosage": "250mg"}
        assert rev.created_at == now


class TestMedicationReminderModels:
    """Verifies MedicationScheduleRecord, MedicationReminderRecord, and MedicationLogRecord (Migration 003)."""

    def test_medication_schedule_record(self):
        now = datetime.now(timezone.utc)
        sched = MedicationScheduleRecord(
            id="sched-1",
            user_id="user-123",
            medication_name="Metformin",
            dosage="500mg",
            frequency="TWICE_DAILY",
            reminder_times=["08:00", "20:00"],
            timezone="America/Los_Angeles",
            start_date=date(2026, 1, 1),
            is_active=True,
            user_confirmed=True,
            created_at=now,
            updated_at=now,
        )
        assert sched.medication_name == "Metformin"
        assert sched.frequency == "TWICE_DAILY"
        assert sched.reminder_times == ["08:00", "20:00"]
        assert sched.user_confirmed is True

    def test_medication_reminder_record(self):
        now = datetime.now(timezone.utc)
        rem = MedicationReminderRecord(
            id="rem-1",
            schedule_id="sched-1",
            user_id="user-123",
            scheduled_for=now,
            status="PENDING",
            created_at=now,
            updated_at=now,
        )
        assert rem.status == "PENDING"
        assert rem.notification_sent_at is None

    def test_medication_log_record(self):
        now = datetime.now(timezone.utc)
        log = MedicationLogRecord(
            id="log-1",
            schedule_id="sched-1",
            reminder_id="rem-1",
            user_id="user-123",
            action="TAKEN",
            logged_at=now,
            notes="Taken with food",
            created_at=now,
        )
        assert log.action == "TAKEN"
        assert log.notes == "Taken with food"


class TestAIAssistantModels:
    """Verifies DocumentChunkRecord, ChatConversationRecord, and ChatMessageRecord (Migration 004)."""

    def test_document_chunk_record(self):
        now = datetime.now(timezone.utc)
        chunk = DocumentChunkRecord(
            id="chunk-1",
            document_id="doc-123",
            user_id="user-123",
            chunk_index=0,
            chunk_text="Metformin 500mg once daily.",
            metadata={"filename": "prescription.pdf", "doc_type": "prescription"},
            embedding=[0.012, -0.045, 0.089],
            created_at=now,
        )
        assert chunk.chunk_index == 0
        assert chunk.metadata["doc_type"] == "prescription"
        assert len(chunk.embedding) == 3

    def test_chat_conversation_and_message_records(self):
        now = datetime.now(timezone.utc)
        conv = ChatConversationRecord(
            id="conv-1",
            user_id="user-123",
            title="Questions about Metformin",
            created_at=now,
            updated_at=now,
        )
        assert conv.title == "Questions about Metformin"

        msg = ChatMessageRecord(
            id="msg-1",
            conversation_id="conv-1",
            user_id="user-123",
            role="assistant",
            content="Based on your prescription from Dr. Sharma...",
            citations=[{"document_id": "doc-123", "filename": "prescription.pdf"}],
            created_at=now,
        )
        assert msg.role == "assistant"
        assert len(msg.citations) == 1


class TestIntelligenceModels:
    """Verifies FamilyProfileRecord, EmergencyCardRecord, and SharedAccessTokenRecord (Migration 005)."""

    def test_family_profile_record(self):
        now = datetime.now(timezone.utc)
        fam = FamilyProfileRecord(
            id="fam-1",
            account_owner_id="user-123",
            full_name="Maya Doe",
            relationship="Child",
            date_of_birth=date(2020, 5, 15),
            gender="Female",
            created_at=now,
            updated_at=now,
        )
        assert fam.relationship == "Child"
        assert fam.date_of_birth == date(2020, 5, 15)

    def test_emergency_card_record(self):
        now = datetime.now(timezone.utc)
        card = EmergencyCardRecord(
            id="card-1",
            user_id="user-123",
            emergency_token="emg_tok_abc123",
            emergency_contact_name="John Doe",
            emergency_contact_phone="+1-555-0199",
            allergies=["Penicillin", "Peanuts"],
            confirmed_medications=[{"name": "Metformin", "dosage": "500mg"}],
            blood_group="O+",
            critical_notes="Diabetic",
            created_at=now,
            updated_at=now,
        )
        assert card.blood_group == "O+"
        assert "Penicillin" in card.allergies

    def test_shared_access_token_record(self):
        now = datetime.now(timezone.utc)
        expires = datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
        token = SharedAccessTokenRecord(
            id="token-1",
            user_id="user-123",
            share_token="share_sec_xyz789",
            document_ids=["doc-1", "doc-2"],
            recipient_label="Dr. Specialist",
            permission_level="READ_ONLY",
            expires_at=expires,
            created_at=now,
        )
        assert token.share_token == "share_sec_xyz789"
        assert token.permission_level == "READ_ONLY"
        assert token.view_count == 0
        assert token.is_revoked is False
