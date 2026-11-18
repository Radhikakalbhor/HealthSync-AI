"""
Comprehensive regression tests for HealthSync AI document management,
classification, RAG assistant safety, reminder adherence, and emergency cards.
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from pathlib import Path

from backend.app.schemas.document import (
    DocumentType,
    DocumentStatus,
    DocumentDetailResponse,
)
from backend.app.schemas.reminders import ReminderStatus, DailyAdherenceItem
from backend.app.schemas.intelligence import EmergencyCardUpdate
from backend.app.services.classifier_service import ClassifierService
from backend.app.services.document_service import DocumentService
from backend.app.services.extractor_service import ExtractorService
from backend.app.services.rag_service import RAGAssistantService
from backend.app.services.reminder_service import ReminderService
from backend.app.services.intelligence_service import IntelligenceService
from backend.app.services.db_service import DatabaseService
from backend.app.core.exceptions import ValidationException, EntityNotFoundException


@pytest.fixture(autouse=True)
def mock_sandbox_no_live_supabase(monkeypatch):
    """Ensure no background calls to live Supabase during sandboxed unit testing."""
    import backend.app.core.supabase_client as sc
    import backend.app.services.document_service as ds
    import backend.app.services.audit_service as aus
    import backend.app.services.db_service as dbs
    import backend.app.services.rag_service as rs
    import backend.app.services.reminder_service as rems
    import backend.app.services.intelligence_service as ints

    from backend.app.core.config import settings
    monkeypatch.setattr(settings, "LLM_API_KEY", "")
    monkeypatch.setattr(settings, "LLM_PROVIDER", "none")
    monkeypatch.setattr(sc, "is_supabase_configured", lambda: False)
    monkeypatch.setattr(ds, "is_supabase_configured", lambda: False)
    monkeypatch.setattr(aus, "is_supabase_configured", lambda: False)
    monkeypatch.setattr(dbs, "is_supabase_configured", lambda: False)
    monkeypatch.setattr(rs, "is_supabase_configured", lambda: False)
    monkeypatch.setattr(rems, "is_supabase_configured", lambda: False)
    monkeypatch.setattr(ints, "is_supabase_configured", lambda: False)


# --------------------------------------------------------------------------
# Test Case 1: Non-Medical Document Pattern Detection
# --------------------------------------------------------------------------
class TestClassifierService:
    def setup_method(self):
        self.classifier = ClassifierService()

    def test_classify_resume_as_non_medical(self):
        resume_text = """
        JOHN DOE
        Software Engineer | Data Scientist
        Email: john.doe@example.com | Phone: 555-123-4567 | LinkedIn: linkedin.com/in/johndoe

        PROFESSIONAL SUMMARY
        Experienced full-stack engineer with 6+ years in Python, React, and PostgreSQL.

        WORK EXPERIENCE
        Senior Software Engineer - Tech Solutions Inc (2021 - Present)
        - Designed and deployed scalable microservices architectures.
        - Mentored junior engineers and led sprint planning.

        EDUCATION
        B.S. in Computer Science - University of California, Berkeley (2014 - 2018)

        TECHNICAL SKILLS
        Python, JavaScript, TypeScript, Docker, Kubernetes, AWS, Git
        """
        doc_type, confidence, is_medical, explanation = self.classifier.classify_document(resume_text)
        assert doc_type == DocumentType.NON_MEDICAL
        assert is_medical is False
        assert confidence == 0.0  # Must never be 100% or positive clinical confidence
        assert "non-medical" in explanation.lower() or "resume" in explanation.lower()

    def test_classify_invoice_as_non_medical(self):
        invoice_text = """
        INVOICE #INV-2024-00891
        Acme Supplies Ltd.
        123 Business Parkway, Suite 400
        Bill To: Jane Smith
        Subtotal: $450.00
        Tax (8.5%): $38.25
        Total Amount Due: $488.25
        Payment Terms: Net 30 days
        Payment Method: Bank Transfer
        """
        doc_type, confidence, is_medical, explanation = self.classifier.classify_document(invoice_text)
        assert doc_type == DocumentType.NON_MEDICAL
        assert is_medical is False
        assert confidence == 0.0

    def test_classify_lease_contract_as_non_medical(self):
        lease_text = """
        RESIDENTIAL LEASE AGREEMENT
        This Agreement made between Landlord and Tenant.
        Terms and Conditions: Rent is due on the 1st of every month.
        Security deposit required upon signing.
        """
        doc_type, confidence, is_medical, explanation = self.classifier.classify_document(lease_text)
        assert doc_type == DocumentType.NON_MEDICAL
        assert is_medical is False
        assert confidence == 0.0


# --------------------------------------------------------------------------
# Test Case 2: Medical Document Classification
# --------------------------------------------------------------------------
    def test_classify_prescription_as_medical(self):
        rx_text = """
        APOLLO HEALTH CLINIC
        Dr. Sarah Jenkins, MD - Internal Medicine
        Rx Date: 12/04/2024
        Patient: Alice Walker, Age: 42, Gender: Female

        Rx:
        1. Amoxicillin 500mg - 1 capsule PO TID for 7 days
        2. Ibuprofen 400mg - 1 tablet PO PRN for pain

        Signature: Dr. S. Jenkins
        License #: MD-99281
        """
        doc_type, confidence, is_medical, explanation = self.classifier.classify_document(rx_text)
        assert doc_type == DocumentType.PRESCRIPTION
        assert is_medical is True
        assert confidence > 0.5

    def test_classify_lab_report_as_medical(self):
        lab_text = """
        METROPOLIS DIAGNOSTIC LABS
        Comprehensive Metabolic Panel & Lipid Profile
        Patient Name: Robert Miller
        Ordering Physician: Dr. Patel
        Collection Date: 10/11/2024

        Test Name                 Observed Value    Reference Range    Unit
        Fasting Blood Glucose     115 (HIGH)        70 - 99            mg/dL
        Hemoglobin A1c            6.2 (HIGH)        4.0 - 5.6          %
        Total Cholesterol         210 (HIGH)        125 - 200          mg/dL
        Triglycerides             160 (HIGH)        < 150              mg/dL
        """
        doc_type, confidence, is_medical, explanation = self.classifier.classify_document(lab_text)
        assert doc_type in [DocumentType.LAB_REPORT, DocumentType.BLOOD_TEST]
        assert is_medical is True
        assert confidence > 0.5

    def test_classify_college_assignment_as_non_medical(self):
        assignment_text = """
        Department of Computer Science
        Course: CS 450 - Operating Systems Architecture
        Homework Assignment #3: Deadlock and Mutex Locks
        Student Name: Alex Smith (Student ID: CS-2024-8832)
        Date: November 14, 2026
        Submission Objective: Implement thread synchronization using semaphores.
        """
        doc_type, confidence, is_medical, _ = self.classifier.classify_document(assignment_text)
        assert doc_type == DocumentType.NON_MEDICAL
        assert is_medical is False
        assert confidence == 0.0

    def test_classify_academic_transcript_as_non_medical(self):
        transcript_text = """
        University Official Academic Transcript
        Student Name: Robert Johnson | Matriculation Number: 2021-ENG-0492
        Degree: Bachelor of Science in Engineering
        Semester 1: Calculus I Grade A, Physics Grade B+
        Cumulative GPA: 3.82 / 4.00
        Academic Status: Good Standing.
        """
        doc_type, confidence, is_medical, _ = self.classifier.classify_document(transcript_text)
        assert doc_type == DocumentType.NON_MEDICAL
        assert is_medical is False
        assert confidence == 0.0

    def test_classify_cbc_report_as_blood_test(self):
        cbc_text = """
        METROPOLITAN HEMATOLOGY LAB
        Patient Name: James Wilson | Ref Doctor: Dr. Stevens
        COMPLETE BLOOD COUNT (CBC) & HEMATOLOGY REPORT:
        - Hemoglobin (Hgb): 14.2 g/dL
        - White Blood Cells (WBC): 6,800 /mcL
        - Platelet Count: 245,000 /mcL
        - Hematocrit: 42.1 %
        """
        doc_type, confidence, is_medical, _ = self.classifier.classify_document(cbc_text)
        assert doc_type == DocumentType.BLOOD_TEST
        assert is_medical is True
        assert confidence >= 0.70

    def test_classify_hba1c_report_as_lab_report(self):
        hba1c_text = """
        ACCURATE LABS & DIAGNOSTICS
        Patient: Maria Garcia | Date: 11-Nov-2026
        DIABETIC MONITORING PROFILE:
        - Glycated Hemoglobin (HbA1c): 6.8 % (Reference: < 5.7% Normal)
        - Fasting Blood Sugar: 126 mg/dL
        Diagnostic Laboratory Director: Dr. L. Thorne
        """
        doc_type, confidence, is_medical, _ = self.classifier.classify_document(hba1c_text)
        assert doc_type == DocumentType.LAB_REPORT
        assert is_medical is True
        assert confidence >= 0.70

    def test_classify_discharge_summary_with_medications_prioritized(self):
        ds_text = """
        ST. JUDE MEMORIAL HOSPITAL
        INPATIENT DISCHARGE SUMMARY
        Patient Name: Thomas Wright | MRN: 902148
        Date of Admission: 02/11/2026
        Date of Discharge: 07/11/2026
        Attending Physician: Dr. Marcus Vance, MD
        Hospital Course: Patient admitted for chest pain, underwent cardiac evaluation.
        Condition at Discharge: Stable.
        Discharge Advice & Prescribed Medications:
        - Atorvastatin 40mg once daily at bedtime
        - Aspirin 81mg daily with meals
        Follow-up visit scheduled in 2 weeks.
        """
        doc_type, confidence, is_medical, _ = self.classifier.classify_document(ds_text)
        assert doc_type == DocumentType.DISCHARGE_SUMMARY
        assert is_medical is True
        assert confidence >= 0.70

    def test_classify_wellness_newsletter_not_prescription(self):
        newsletter_text = """
        HEALTH AND WELLNESS CLUB - MONTHLY NEWSLETTER
        Welcome to our community wellness overview!
        Eating healthy meals, regular hydration, and daily morning walks support overall lifestyle balance.
        Our weekend workshop focuses on stretching exercises and mindfulness breathing.
        Contact organizer: Sarah at info@wellnessclub.org.
        """
        doc_type, confidence, is_medical, _ = self.classifier.classify_document(newsletter_text)
        assert doc_type != DocumentType.PRESCRIPTION
        assert doc_type == DocumentType.OTHER
        assert is_medical is False
        assert confidence == 0.0

    def test_classify_healthy_eating_article_not_prescription(self):
        article_text = """
        COMMUNITY NUTRITION GUIDE
        Healthy eating tips:
        Enjoy balanced meals with family. Drink water daily with meals and after meals.
        Walking 30 minutes daily improves cardiovascular endurance.
        """
        doc_type, confidence, is_medical, _ = self.classifier.classify_document(article_text)
        assert doc_type != DocumentType.PRESCRIPTION
        assert doc_type == DocumentType.OTHER
        assert is_medical is False
        assert confidence == 0.0

    def test_classify_fragmented_ocr_requires_verification(self):
        fragmented_text = """
        ... Dr. ... hosp ...
        ... tab 500mg ...
        ... unreadable smudge ...
        """
        doc_type, confidence, is_medical, _ = self.classifier.classify_document(fragmented_text)
        # Even if tentatively prescription due to tab 500mg, confidence must be low (<0.70)
        assert confidence < 0.70

    def test_empty_ocr_text_handling(self):
        doc_type, confidence, is_medical, explanation = self.classifier.classify_document("")
        assert doc_type == DocumentType.OTHER
        assert is_medical is False
        assert confidence == 0.0


# --------------------------------------------------------------------------
# Test Cases 3, 4, 5: DocumentService Null-Safety, Status & Review Blocking
# --------------------------------------------------------------------------
class TestDocumentDetailResponseSafety:
    def test_null_safe_schema_handling(self):
        raw_db_record = {
            "document_id": "doc-uuid-999",
            "user_id": "user-uuid-111",
            "original_filename": "patient_scan.pdf",
            "document_type": "imaging_report",
            "status": "extracted",
            "file_size_bytes": 20480,
            "mime_type": "application/pdf",
            "created_at": "2026-11-16T10:00:00Z",
            "updated_at": "2026-11-16T10:05:00Z",
        }
        res = DocumentService._build_detail_response(raw_db_record)
        assert res.document_id == "doc-uuid-999"
        assert res.original_filename == "patient_scan.pdf"
        assert res.status == DocumentStatus.EXTRACTED
        assert res.document_type == DocumentType.IMAGING_REPORT

    def test_non_medical_detail_response_forces_null_confidence(self):
        """Ensures non-medical documents never have 100% confidence or needs_human_review."""
        raw_db_record = {
            "document_id": "doc-resume-01",
            "user_id": "user-uuid-111",
            "original_filename": "resume.pdf",
            "document_type": "non_medical",
            "status": "unsupported",
            "confidence": 1.0,  # e.g., PyMuPDF raw text confidence
            "requires_verification": True,
            "raw_text": "Software Engineer with React and Python experience. Education: BS CS.",
        }
        res = DocumentService._build_detail_response(raw_db_record)
        assert res.document_type == DocumentType.NON_MEDICAL
        assert res.status == DocumentStatus.UNSUPPORTED
        assert res.ocr_confidence is None
        assert res.confidence_score is None
        assert res.needs_human_review is False

    def test_empty_record_defaults(self):
        res = DocumentService._build_detail_response({})
        assert res.document_id == ""
        assert res.filename == "unnamed_document"
        assert res.status == DocumentStatus.UPLOADED
        assert res.document_type == DocumentType.OTHER

    def test_update_review_blocks_non_medical(self):
        mock_record = {
            "id": "doc-resume-01",
            "user_id": "user-001",
            "original_filename": "resume.pdf",
            "document_type": DocumentType.NON_MEDICAL.value,
            "status": DocumentStatus.UNSUPPORTED.value,
        }

        with patch.object(DocumentService, "get_document_record", return_value=mock_record):
            with pytest.raises(ValidationException) as exc_info:
                DocumentService.update_review(
                    doc_id="doc-resume-01",
                    user_id="user-001",
                    corrections={"structured_data": {"patient_name": "Faked Patient"}},
                )
            assert "unsupported or non-medical document" in str(exc_info.value).lower()


# --------------------------------------------------------------------------
# Test Case 6: Document Reclassification Service
# --------------------------------------------------------------------------
class TestReclassificationService:
    def test_reclassify_user_documents_idempotent(self):
        user_id = "test-user-migration-01"
        doc_id = "doc-resume-legacy-01"

        mock_record = {
            "document_id": doc_id,
            "id": doc_id,
            "user_id": user_id,
            "original_filename": "My_Resume.pdf",
            "document_type": "other",  # Uploaded prior to classification fix
            "status": "uploaded",
            "raw_text": (
                "John Doe - Senior Software Engineer\n"
                "Work Experience: 5 years in backend engineering\n"
                "Education: University of Michigan B.S. Computer Science\n"
                "Skills: Python, AWS, Docker\n"
            ),
        }

        with patch.object(DocumentService, "_load_all_records", return_value={doc_id: mock_record}), \
             patch.object(DocumentService, "get_document_record", return_value=mock_record), \
             patch.object(DocumentService, "_save_record") as mock_save, \
             patch.object(RAGAssistantService, "delete_document_chunks") as mock_rag_del:

            # 1. Dry run
            dry_res = DocumentService.reclassify_user_documents(user_id, dry_run=True)
            assert dry_res["reclassified_count"] == 1
            assert dry_res["dry_run"] is True
            assert mock_save.call_count == 0

            # 2. Live reclassification
            live_res = DocumentService.reclassify_user_documents(user_id, dry_run=False)
            assert live_res["reclassified_count"] == 1
            assert live_res["dry_run"] is False
            assert mock_save.call_count >= 1
            mock_rag_del.assert_called_with(doc_id, user_id)


# --------------------------------------------------------------------------
# Test Cases 7, 8, 9: RAG Assistant Document Exclusion, Retrieval & Fallback
# --------------------------------------------------------------------------
class TestRAGSafetyAndFiltering:
    def test_chunk_and_index_document_rejects_non_medical(self):
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-res-01",
            user_id="user-rag-01",
            filename="cv.pdf",
            doc_type="non_medical",
            raw_text="Education: University degree. Skills: Python.",
            structured_data=None,
        )
        assert chunks == []

    def test_chunk_and_index_document_rejects_other_unclassified(self):
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-other-01",
            user_id="user-rag-01",
            filename="letter.pdf",
            doc_type="other",
            raw_text="To whom it may concern.",
            structured_data=None,
        )
        assert chunks == []

    def test_chunk_and_index_document_allowed_for_valid_high_confidence(self):
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-valid-rx-01",
            user_id="user-rag-valid",
            filename="prescription.pdf",
            doc_type="prescription",
            raw_text="Dr. Smith prescribed Amoxicillin 500mg.",
            structured_data={
                "doctor_name": "Dr. Smith",
                "medications": [{"name": "Amoxicillin", "dosage": "500mg", "frequency": "tid", "instructions": "after meals"}]
            },
            confidence=0.95,
            status="extracted",
            requires_verification=False,
        )
        assert len(chunks) > 0

    def test_chunk_and_index_document_blocked_for_low_confidence(self):
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-low-conf-01",
            user_id="user-rag-valid",
            filename="unclear_rx.pdf",
            doc_type="prescription",
            raw_text="Smudged prescription text.",
            structured_data=None,
            confidence=0.50,
            status="extracted",
            requires_verification=False,
        )
        assert chunks == []

    def test_chunk_and_index_document_blocked_for_missing_confidence(self):
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-no-conf-01",
            user_id="user-rag-valid",
            filename="no_conf_rx.pdf",
            doc_type="prescription",
            raw_text="Amoxicillin 500mg.",
            structured_data=None,
            confidence=None,
            status="extracted",
            requires_verification=False,
        )
        assert chunks == []

    def test_chunk_and_index_document_blocked_for_human_review_required(self):
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-review-req-01",
            user_id="user-rag-valid",
            filename="needs_review_rx.pdf",
            doc_type="prescription",
            raw_text="Amoxicillin 500mg with unclear directions.",
            structured_data=None,
            confidence=0.85,
            status="needs_review",
            requires_verification=True,
        )
        assert chunks == []

    def test_chunk_and_index_document_blocked_for_disallowed_status(self):
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-status-upload-01",
            user_id="user-rag-valid",
            filename="uploaded_rx.pdf",
            doc_type="prescription",
            raw_text="Amoxicillin 500mg.",
            structured_data=None,
            confidence=0.90,
            status="uploaded",
            requires_verification=False,
        )
        assert chunks == []

    def test_chunk_and_index_document_allowed_for_verified_medical(self):
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-verified-01",
            user_id="user-rag-valid",
            filename="verified_lab.pdf",
            doc_type="lab_report",
            raw_text="Hemoglobin: 14.5 g/dL",
            structured_data={"results": [{"test_name": "Hemoglobin", "value": "14.5", "unit": "g/dL"}]},
            confidence=0.98,
            status="verified",
            requires_verification=False,
        )
        assert len(chunks) > 0

    def test_retrieve_relevant_chunks_ignores_non_medical_documents(self):
        user_id = "user-rag-isolated"
        mock_docs = [
            DocumentDetailResponse(
                document_id="doc-resume",
                id="doc-resume",
                original_filename="Software_Engineer_Resume.pdf",
                document_type=DocumentType.NON_MEDICAL,
                file_size_bytes=1024,
                mime_type="application/pdf",
                status=DocumentStatus.UNSUPPORTED,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        ]

        with patch.object(DocumentService, "list_user_documents", return_value=mock_docs):
            chunks = RAGAssistantService.retrieve_relevant_chunks(
                user_id=user_id,
                query="What was my HbA1c value in my last lab report?",
            )
            assert len(chunks) == 0


    def test_ask_question_returns_exact_fallback_when_no_medical_source(self):
        user_id = "user-rag-fallback"
        conv_id = "conv-test-01"

        mock_docs = [
            DocumentDetailResponse(
                document_id="doc-resume",
                id="doc-resume",
                original_filename="Software_Engineer_Resume.pdf",
                document_type=DocumentType.NON_MEDICAL,
                file_size_bytes=1024,
                mime_type="application/pdf",
                status=DocumentStatus.UNSUPPORTED,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        ]

        with patch.object(DocumentService, "list_user_documents", return_value=mock_docs), \
             patch.object(RAGAssistantService, "_load_data", return_value={"conversations": {conv_id: {"id": conv_id, "user_id": user_id}}, "messages": {}, "chunks": {}}), \
             patch.object(RAGAssistantService, "_save_data"):

            coro = RAGAssistantService.ask_question(
                conv_id=conv_id,
                user_id=user_id,
                user_query="What was my HbA1c value in my last lab report?",
            )
            try:
                coro.send(None)
            except StopIteration as e:
                response = e.value
                assert response.content == "I couldn't find this information in your uploaded medical records."
                assert response.citations == []


# --------------------------------------------------------------------------
# Test Case 10: Medication Reminders 0-Dose Adherence
# --------------------------------------------------------------------------
class TestReminderAdherence:
    def test_adherence_with_zero_scheduled_doses(self):
        user_id = "user-reminder-01"

        with patch.object(ReminderService, "_load_data", return_value={"schedules": {}, "reminders": {}}):
            stats = ReminderService.get_adherence_stats(user_id=user_id, days=7)

            assert stats.total_scheduled == 0
            assert stats.total_taken == 0
            assert stats.total_skipped == 0
            assert stats.total_missed == 0
            # MUST be None / null, never 100.0% when denominator is 0
            assert stats.adherence_percentage is None
            assert stats.streak_days == 0


# --------------------------------------------------------------------------
# Test Cases 11 & 12: Emergency Card & Token Rotation
# --------------------------------------------------------------------------
class TestEmergencyCardService:
    def test_get_or_create_emergency_card_generates_token(self):
        user_id = "user-emg-01"
        with patch.object(IntelligenceService, "_load_data", return_value={"shares": {}, "emergency_cards": {}, "family_profiles": {}}), \
             patch.object(IntelligenceService, "_save_data"):

            card = IntelligenceService.get_or_create_emergency_card(user_id)
            assert card.emergency_token.startswith("emg_")
            assert f"/emergency/{card.emergency_token}" in card.emergency_url
            assert card.qr_code_data_url.startswith("data:image/png;base64,")

    def test_public_emergency_card_does_not_leak_user_id(self):
        user_id = "user-emg-secret"
        token = "emg_secret_12345"

        stored_card = {
            "id": "card-001",
            "user_id": user_id,
            "emergency_token": token,
            "emergency_contact_name": "Emergency Person",
            "emergency_contact_phone": "+1-555-0199",
            "blood_group": "O+",
            "allergies": ["Penicillin"],
            "confirmed_medications": ["Metformin"],
            "critical_notes": "Type 2 Diabetic",
            "is_active": True,
        }

        with patch.object(IntelligenceService, "_load_data", return_value={"emergency_cards": {user_id: stored_card}}):
            public_view = IntelligenceService.get_public_emergency_card(token)
            assert public_view.emergency_token == token
            # CRITICAL: user_id is protected and not leaked to responders
            assert public_view.user_id == "protected"
            assert public_view.blood_group == "O+"
            assert "Penicillin" in public_view.allergies

    def test_rotate_emergency_token(self):
        user_id = "user-emg-rotate"
        old_token = "emg_old_111"

        stored_card = {
            "id": "card-rotate-001",
            "user_id": user_id,
            "emergency_token": old_token,
            "is_active": True,
        }

        with patch.object(IntelligenceService, "_load_data", return_value={"emergency_cards": {user_id: stored_card}}), \
             patch.object(IntelligenceService, "_save_data"):

            updated_card = IntelligenceService.rotate_emergency_token(user_id)
            assert updated_card.emergency_token != old_token
            assert updated_card.emergency_token.startswith("emg_")


# --------------------------------------------------------------------------
# Test Cases 13: Discharge Summary Subtype & Multiline Sig Regression
# --------------------------------------------------------------------------
class TestDischargeSummaryAndMultilineSigHardening:
    """
    Comprehensive regression tests for:
    - Discharge summary subtype retention over embedded take-home medications
    - Multiline Sig instruction association without creating bogus medications
    - Human verification requirements on missing or ambiguous frequencies
    - Strict multi-barrier RAG security enforcement
    """

    def test_discharge_summary_with_four_or_more_medications_retains_subtype(self):
        text = (
            "ST. JUDE MEMORIAL HOSPITAL\n"
            "DEPARTMENT OF INTERNAL MEDICINE & CARDIOLOGY\n"
            "INPATIENT DISCHARGE SUMMARY\n"
            "Patient Name: Thomas Wright        MRN: 902148     Age: 64\n"
            "Date of Admission: 02/11/2026      Date of Discharge: 07/11/2026\n"
            "Attending Physician: Dr. Marcus Vance, MD (Cardiology)\n"
            "Hospital Course: Patient admitted with NSTEMI. Stent placed successfully.\n"
            "Condition at Discharge: Compensated, stable, ambulatory.\n"
            "Discharge Diagnosis: Coronary Artery Disease, Status Post Stent Placement.\n"
            "Discharge Advice & Prescribed Take-Home Medications:\n"
            "- Tab Aspirin 81mg orally once daily with morning meals\n"
            "- Tab Atorvastatin 40mg orally once daily at bedtime\n"
            "- Tab Metoprolol Succinate 25mg orally once daily\n"
            "- Tab Clopidogrel 75mg orally once daily for 12 months\n"
            "Follow-up: Clinic consultation scheduled in 2 weeks with Dr. Vance.\n"
        )
        # 1. Classification check
        doc_type, conf, is_med, reason = ClassifierService.classify_document(text)
        assert doc_type == DocumentType.DISCHARGE_SUMMARY, f"Expected DISCHARGE_SUMMARY, got {doc_type}"
        assert is_med is True
        assert conf >= 0.85

        # 2. Structured extraction check
        extracted = ExtractorService.extract_discharge_summary(text)
        assert extracted.patient_name == "Thomas Wright"
        assert extracted.admission_date == "02/11/2026"
        assert extracted.discharge_date == "07/11/2026"
        assert extracted.discharge_diagnosis == "Coronary Artery Disease, Status Post Stent Placement."
        assert len(extracted.discharge_medications) == 4
        med_names = [m.name for m in extracted.discharge_medications]
        assert "Aspirin" in med_names
        assert "Atorvastatin" in med_names
        assert "Metoprolol Succinate" in med_names
        assert "Clopidogrel" in med_names

        # 3. Verification evaluation
        flagged, req_review, notes = ExtractorService.evaluate_verification_needs(
            extracted, DocumentType.DISCHARGE_SUMMARY, ocr_confidence=1.0
        )
        assert flagged == []
        assert req_review is False

        # 4. RAG indexing eligibility check
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-test-ds-001",
            user_id="user-qa-01",
            filename="discharge_summary.pdf",
            doc_type=DocumentType.DISCHARGE_SUMMARY.value,
            raw_text=text,
            structured_data=extracted.model_dump(),
            confidence=conf,
            status=DocumentStatus.EXTRACTED.value,
            requires_verification=False,
        )
        assert len(chunks) >= 1
        assert all(c["metadata"]["doc_type"] == "discharge_summary" for c in chunks)

    def test_standalone_prescription_with_multiline_sig(self):
        text = (
            "METRO HEALTH CLINIC\n"
            "Dr. Sarah Jenkins, MD - Internal Medicine\n"
            "Patient Name: Arthur Dent          Date: 10/11/2026\n"
            "Diagnosis: Acute Streptococcal Pharyngitis\n"
            "Rx:\n"
            "1. Tab Amoxicillin 500mg\n"
            "   Sig: 1 tablet orally TID (thrice daily) after meals x 7 days\n"
            "   Dispense: #21 (twenty-one) | Refills: 0\n"
        )
        # 1. Classification
        doc_type, conf, is_med, _ = ClassifierService.classify_document(text)
        assert doc_type == DocumentType.PRESCRIPTION
        assert is_med is True

        # 2. Medication extraction
        rx = ExtractorService.extract_prescription(text)
        assert rx.patient_name == "Arthur Dent"
        # Must extract exactly 1 medication, NOT 2 or 3
        assert len(rx.medications) == 1
        amox = rx.medications[0]
        assert amox.name == "Amoxicillin"
        assert amox.dosage == "500mg"
        assert "TID" in amox.frequency or "thrice daily" in amox.frequency
        assert amox.duration == "7 days"
        assert "orally" in amox.instructions
        assert "after meals" in amox.instructions

        # 3. Verification check
        flagged, req_review, _ = ExtractorService.evaluate_verification_needs(
            rx, DocumentType.PRESCRIPTION, ocr_confidence=1.0
        )
        assert flagged == []
        assert req_review is False

        # 4. RAG indexing
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-test-rx-amox",
            user_id="user-qa-01",
            filename="amoxicillin_rx.pdf",
            doc_type=DocumentType.PRESCRIPTION.value,
            raw_text=text,
            structured_data=rx.model_dump(),
            confidence=0.95,
            status=DocumentStatus.EXTRACTED.value,
            requires_verification=False,
        )
        assert len(chunks) >= 1

    def test_prescription_with_multiple_medications_and_separate_sig_instructions(self):
        text = (
            "METRO HEALTH CLINIC\n"
            "Dr. Sarah Jenkins, MD\n"
            "Patient Name: Arthur Dent          Date: 10/11/2026\n"
            "Rx:\n"
            "1. Tab Amoxicillin 500mg\n"
            "   Sig: 1 tablet orally TID (thrice daily) after meals x 7 days\n"
            "   Dispense: #21\n"
            "2. Tab Paracetamol 650mg\n"
            "   Sig: 1 tablet orally SOS every 6 hours PRN for fever / pain\n"
            "   Dispense: #10\n"
            "3. Syp Cough Relief 10ml\n"
            "   Sig: 10ml orally twice daily before bedtime\n"
            "   Dispense: 100ml bottle\n"
        )
        rx = ExtractorService.extract_prescription(text)
        # Exactly 3 medications, no bogus Sig or Dispense medications
        assert len(rx.medications) == 3
        names = [m.name for m in rx.medications]
        assert names == ["Amoxicillin", "Paracetamol", "Cough Relief"]
        assert all(m.dosage is not None for m in rx.medications)
        assert all(m.frequency is not None for m in rx.medications)

        flagged, req_review, _ = ExtractorService.evaluate_verification_needs(
            rx, DocumentType.PRESCRIPTION, ocr_confidence=1.0
        )
        assert flagged == []
        assert req_review is False

    def test_prescription_with_missing_frequency_triggers_human_verification(self):
        text = (
            "CITY MEDICAL CENTER\n"
            "Dr. Robert Lee, MD\n"
            "Patient Name: Jane Doe          Date: 12/11/2026\n"
            "Rx:\n"
            "- Tab Lisinopril 10mg\n"
            "  Sig: 1 tablet orally with water\n"
        )
        rx = ExtractorService.extract_prescription(text)
        assert len(rx.medications) == 1
        assert rx.medications[0].dosage == "10mg"
        assert rx.medications[0].frequency is None

        flagged, req_review, _ = ExtractorService.evaluate_verification_needs(
            rx, DocumentType.PRESCRIPTION, ocr_confidence=1.0
        )
        assert "medication[0].frequency" in flagged
        assert req_review is True

        # Gate 4: RAG must exclude document because requires_verification is True
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-test-rx-missing-freq",
            user_id="user-qa-01",
            filename="lisinopril_incomplete.pdf",
            doc_type=DocumentType.PRESCRIPTION.value,
            raw_text=text,
            structured_data=rx.model_dump(),
            confidence=0.90,
            status=DocumentStatus.NEEDS_REVIEW.value,
            requires_verification=True,
        )
        assert len(chunks) == 0


    def test_prescription_with_ambiguous_instructions_triggers_human_verification(self):
        text = (
            "OUTPATIENT CLINIC\n"
            "Dr. Mark Davis, MD\n"
            "Patient Name: John Smith          Date: 12/11/2026\n"
            "Rx:\n"
            "- Tab Metformin 500mg\n"
            "  Sig: take as directed by physician\n"
        )
        rx = ExtractorService.extract_prescription(text)
        assert len(rx.medications) == 1
        assert rx.medications[0].frequency is None

        flagged, req_review, _ = ExtractorService.evaluate_verification_needs(
            rx, DocumentType.PRESCRIPTION, ocr_confidence=1.0
        )
        assert "medication[0].frequency" in flagged
        assert req_review is True

        # RAG Gate 4 exclusion
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-test-rx-ambiguous",
            user_id="user-qa-01",
            filename="metformin_ambiguous.pdf",
            doc_type=DocumentType.PRESCRIPTION.value,
            raw_text=text,
            structured_data=rx.model_dump(),
            confidence=0.85,
            status=DocumentStatus.NEEDS_REVIEW.value,
            requires_verification=True,
        )
        assert len(chunks) == 0


    def test_existing_cbc_and_hba1c_behavior(self):
        cbc_text = (
            "METROPOLITAN HEMATOLOGY & PATHOLOGY LAB\n"
            "Patient Name: Eleanor Vance        Age: 38\n"
            "Test Name                  Result    Units     Reference Range\n"
            "White Blood Cell (WBC)     7.2       x10^3/uL  4.5 - 11.0\n"
            "Red Blood Cell (RBC)       4.85      x10^6/uL  4.20 - 5.40\n"
            "Hemoglobin (Hgb)           14.2      g/dL      12.0 - 16.0\n"
            "Platelets                  245       x10^3/uL  150 - 450\n"
        )
        doc_type, conf, is_med, _ = ClassifierService.classify_document(cbc_text)
        assert doc_type == DocumentType.BLOOD_TEST
        assert is_med is True
        assert conf >= 0.90

        lab_data = ExtractorService.extract_lab_report(cbc_text, category="Hematology")
        assert len(lab_data.tests) >= 3
        flagged, req_review, _ = ExtractorService.evaluate_verification_needs(
            lab_data, DocumentType.BLOOD_TEST, ocr_confidence=1.0
        )
        assert req_review is False

        hba1c_text = (
            "ACCURATE LABS & DIAGNOSTICS\n"
            "Comprehensive Metabolic & Endocrine Profiling\n"
            "Patient Name: David Miller        Age: 52\n"
            "Test Name               Result    Units    Reference Range\n"
            "Hemoglobin A1c (HbA1c)  6.8       %        < 5.7 Normal\n"
            "Estimated Average Glucose 148     mg/dL    < 117\n"
            "Fasting Plasma Glucose  132       mg/dL    70 - 99\n"
        )
        doc_type_h, conf_h, is_med_h, _ = ClassifierService.classify_document(hba1c_text)
        assert doc_type_h in [DocumentType.LAB_REPORT, DocumentType.BLOOD_TEST]
        assert is_med_h is True
        assert conf_h >= 0.88

    def test_wellness_newsletter_rejection(self):
        newsletter_text = (
            "OAKRIDGE COMMUNITY WELLNESS CLUB\n"
            "MONTHLY LIFESTYLE & WELLBEING NEWSLETTER - ISSUE 44\n"
            "Tips for Healthy Living:\n"
            "1. Aim for a 30-minute walk daily with morning sunlight.\n"
            "2. Eat nutritious meals with plenty of fiber and leafy vegetables.\n"
            "3. Practice 10 minutes of mindfulness daily before bedtime.\n"
        )
        doc_type, conf, is_med, reason = ClassifierService.classify_document(newsletter_text)
        assert doc_type == DocumentType.OTHER
        assert is_med is False
        assert conf == 0.0

        # RAG Gate 1: Non-allowed document type excluded
        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-test-newsletter",
            user_id="user-qa-01",
            filename="newsletter.pdf",
            doc_type=doc_type.value,
            raw_text=newsletter_text,
            structured_data=None,
            confidence=conf,
            status=DocumentStatus.EXTRACTED.value,
            requires_verification=False,
        )
        assert len(chunks) == 0


    def test_resume_rejection(self):
        resume_text = (
            "ALEXANDER CHEN\n"
            "Senior Software Engineer | Cloud Architecture\n"
            "Education: B.S. in Computer Science - University of California, Berkeley\n"
            "Technical Skills: Python, TypeScript, Docker, Kubernetes, PostgreSQL\n"
            "Work Experience: Senior Backend Engineer at CloudScale Technologies\n"
        )
        doc_type, conf, is_med, reason = ClassifierService.classify_document(resume_text)
        assert doc_type == DocumentType.NON_MEDICAL
        assert is_med is False
        assert conf == 0.0

        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-test-resume",
            user_id="user-qa-01",
            filename="resume.pdf",
            doc_type=doc_type.value,
            raw_text=resume_text,
            structured_data=None,
            confidence=None,
            status=DocumentStatus.UNSUPPORTED.value,
            requires_verification=False,
        )
        assert len(chunks) == 0


    def test_incomplete_medical_document_quarantine(self):
        draft_note = (
            "CLINICAL ENCOUNTER NOTE (DRAFT)\n"
            "Date: 15/11/2026\n"
            "Attending Doctor: Dr. H. Roberts\n"
            "Patient: [Illegible handwritten smudge]\n"
            "Exam: Throat erythematous.\n"
            "Rx:\n"
            "- Amoxicillin [dosage unrecorded, missing frequency]\n"
            "NOTE: Encounter incomplete. Physician must clarify dosage before dispensing.\n"
        )
        rx = ExtractorService.extract_prescription(draft_note)
        flagged, req_review, notes = ExtractorService.evaluate_verification_needs(
            rx, DocumentType.PRESCRIPTION, ocr_confidence=0.82
        )
        assert req_review is True

        chunks = RAGAssistantService.chunk_and_index_document(
            doc_id="doc-test-incomplete-quarantine",
            user_id="user-qa-01",
            filename="incomplete_note.pdf",
            doc_type=DocumentType.PRESCRIPTION.value,
            raw_text=draft_note,
            structured_data=rx.model_dump(),
            confidence=0.82,
            status=DocumentStatus.NEEDS_REVIEW.value,
            requires_verification=True,
        )
        assert len(chunks) == 0


class TestExtractionResultHydration:
    """Unit and integration tests for document extraction_result hydration."""

    def test_supabase_prescription_detail_hydration(self):
        user_id = "test-user-hydrate-rx"
        doc_id = "doc-test-hydrate-rx"
        doc = {
            "id": doc_id,
            "document_id": doc_id,
            "user_id": user_id,
            "document_type": "prescription",
            "status": "extracted",
            "raw_text": "Sample prescription text",
            "confidence": 0.98,
            "requires_verification": False,
            "fields_requiring_verification": [],
        }

        mock_rx = [{
            "patient_name": "Arthur Dent",
            "doctor_name": "Dr. Sarah Jenkins",
            "clinic_or_hospital": "Metro Clinic",
            "prescription_date": "10/11/2026",
            "diagnosis_text": "Acute Pharyngitis",
        }]
        mock_meds = [
            {"name": "Amoxicillin", "dosage": "500mg", "frequency": "TID", "duration": "7 days", "instructions": "after meals"},
            {"name": "Paracetamol", "dosage": "650mg", "frequency": "SOS", "duration": None, "instructions": "for fever"},
            {"name": "Cough Relief", "dosage": "10ml", "frequency": "twice daily", "duration": None, "instructions": "bedtime"},
        ]

        class MockQuery:
            def __init__(self, data):
                self._data = data
            def select(self, *args, **kwargs): return self
            def eq(self, *args, **kwargs): return self
            def order(self, *args, **kwargs): return self
            def execute(self):
                class MockRes:
                    data = self._data
                return MockRes()

        class MockClient:
            def table(self, table_name):
                if table_name == "extracted_prescriptions":
                    return MockQuery(mock_rx)
                elif table_name == "extracted_medications":
                    return MockQuery(mock_meds)
                return MockQuery([])

        with patch("backend.app.services.db_service.is_supabase_configured", return_value=True), \
             patch("backend.app.services.db_service.get_supabase_admin_client", return_value=MockClient()):
            hydrated = DatabaseService.hydrate_extraction_result(doc, user_id)
            assert hydrated is not None
            assert hydrated["document_type"] == "prescription"
            struct = hydrated["structured_data"]
            assert struct["patient_name"] == "Arthur Dent"
            assert struct["doctor_name"] == "Dr. Sarah Jenkins"
            assert len(struct["medications"]) == 3
            assert struct["medications"][0]["name"] == "Amoxicillin"

    def test_supabase_lab_report_detail_hydration(self):
        user_id = "test-user-hydrate-lr"
        doc_id = "doc-test-hydrate-lr"
        doc = {
            "id": doc_id,
            "document_id": doc_id,
            "user_id": user_id,
            "document_type": "lab_report",
            "status": "extracted",
            "raw_text": "Sample lab text",
            "confidence": 1.0,
            "requires_verification": False,
            "fields_requiring_verification": [],
        }

        mock_lr = [{
            "patient_name": "James Wilson",
            "doctor_or_lab_name": "Pathology Lab",
            "report_date": "14/11/2026",
            "test_category": "Hematology",
        }]
        mock_results = [
            {"test_name": "Hemoglobin", "measured_value": "15.0", "unit": "g/dL", "reference_range": "13.5-17.5", "test_category": "CBC", "is_abnormal": False},
            {"test_name": "WBC", "measured_value": "11.5", "unit": "10^3/uL", "reference_range": "4.5-11.0", "test_category": "CBC", "is_abnormal": True},
        ]

        class MockQuery:
            def __init__(self, data):
                self._data = data
            def select(self, *args, **kwargs): return self
            def eq(self, *args, **kwargs): return self
            def order(self, *args, **kwargs): return self
            def execute(self):
                class MockRes:
                    data = self._data
                return MockRes()

        class MockClient:
            def table(self, table_name):
                if table_name == "extracted_lab_reports":
                    return MockQuery(mock_lr)
                elif table_name == "extracted_lab_results":
                    return MockQuery(mock_results)
                return MockQuery([])

        with patch("backend.app.services.db_service.is_supabase_configured", return_value=True), \
             patch("backend.app.services.db_service.get_supabase_admin_client", return_value=MockClient()):
            hydrated = DatabaseService.hydrate_extraction_result(doc, user_id)
            assert hydrated is not None
            assert hydrated["document_type"] == "lab_report"
            struct = hydrated["structured_data"]
            assert struct["patient_name"] == "James Wilson"
            assert len(struct["tests"]) == 2
            assert struct["tests"][0]["test_name"] == "Hemoglobin"
            assert struct["tests"][1]["is_abnormal"] is True

    def test_discharge_summary_detail_hydration(self):
        user_id = "test-user-hydrate-ds"
        doc_id = "doc-test-hydrate-ds"
        raw_text = (
            "HOSPITAL DISCHARGE SUMMARY\n"
            "ST. JUDE MEMORIAL HOSPITAL\n"
            "Patient: Thomas Wright\n"
            "Admission Date: 02/11/2026\n"
            "Discharge Date: 07/11/2026\n"
            "Discharge Diagnosis: Coronary Artery Disease, Status Post Stent Placement.\n"
            "Hospital Course: Patient underwent successful stent placement.\n"
            "Discharge Medications:\n"
            "1. Aspirin 81mg once daily with meals\n"
            "2. Atorvastatin 40mg once daily at bedtime\n"
            "3. Metoprolol Succinate 25mg once daily\n"
            "4. Clopidogrel 75mg once daily for 12 months\n"
            "Discharge Advice: Avoid strenuous exercise.\n"
        )
        doc = {
            "id": doc_id,
            "document_id": doc_id,
            "user_id": user_id,
            "document_type": "discharge_summary",
            "status": "extracted",
            "raw_text": raw_text,
            "confidence": 0.98,
            "requires_verification": False,
            "fields_requiring_verification": [],
        }

        with patch("backend.app.services.db_service.is_supabase_configured", return_value=False):
            hydrated = DatabaseService.hydrate_extraction_result(doc, user_id)
            assert hydrated is not None
            assert hydrated["document_type"] == "discharge_summary"
            struct = hydrated["structured_data"]
            assert struct["patient_name"] == "Thomas Wright"
            assert "Coronary Artery Disease" in struct["discharge_diagnosis"]
            assert len(struct["discharge_medications"]) == 4

    def test_local_storage_detail_hydration(self):
        user_id = "test-user-local"
        doc_id = "doc-local-test-123"
        doc = {
            "id": doc_id,
            "document_id": doc_id,
            "user_id": user_id,
            "document_type": "prescription",
            "status": "extracted",
            "raw_text": "Prescription text",
            "confidence": 0.95,
            "requires_verification": False,
            "fields_requiring_verification": [],
        }

        mock_local_meta = {
            doc_id: {
                "id": doc_id,
                "user_id": user_id,
                "extraction_result": {
                    "document_id": doc_id,
                    "document_type": "prescription",
                    "raw_text": "Prescription text",
                    "ocr_engine": "pdfplumber",
                    "confidence": 0.95,
                    "structured_data": {
                        "patient_name": "Arthur Dent",
                        "medications": [{"name": "Amoxicillin", "dosage": "500mg"}],
                    },
                    "requires_verification": False,
                    "fields_requiring_verification": [],
                }
            }
        }

        with patch("backend.app.services.db_service.is_supabase_configured", return_value=False), \
             patch("builtins.open", mock_open_metadata(mock_local_meta)):
            hydrated = DatabaseService.hydrate_extraction_result(doc, user_id)
            assert hydrated is not None
            assert hydrated["structured_data"]["patient_name"] == "Arthur Dent"

    def test_unsupported_and_non_medical_responses(self):
        user_id = "test-user-non-med"
        
        # 1. Non-medical document
        doc_non_med = {
            "id": "doc-resume-test",
            "user_id": user_id,
            "document_type": "non_medical",
            "status": "unsupported",
            "raw_text": "Software Engineer Resume",
        }
        res1 = DatabaseService.hydrate_extraction_result(doc_non_med, user_id)
        assert res1 is None

        # 2. Unsupported document
        doc_unsupported = {
            "id": "doc-unsupported-test",
            "user_id": user_id,
            "document_type": "other",
            "status": "unsupported",
            "raw_text": "Some text",
        }
        res2 = DatabaseService.hydrate_extraction_result(doc_unsupported, user_id)
        assert res2 is None

    def test_missing_structured_data_handling(self):
        user_id = "test-user-missing"
        # Document with no text, no relational rows, no local records
        doc_empty = {
            "id": "doc-empty-test",
            "user_id": user_id,
            "document_type": "prescription",
            "status": "extracted",
            "raw_text": "",
        }
        with patch("backend.app.services.db_service.is_supabase_configured", return_value=False):
            res = DatabaseService.hydrate_extraction_result(doc_empty, user_id)
            assert res is None

    def test_missing_optional_fields_handling(self):
        user_id = "test-user-partial"
        doc_id = "doc-partial-rx"
        doc = {
            "id": doc_id,
            "user_id": user_id,
            "document_type": "prescription",
            "status": "needs_review",
            "raw_text": "Rx: Amoxicillin",
            "confidence": 0.85,
            "requires_verification": True,
            "fields_requiring_verification": ["frequency"],
        }
        mock_rx = [{
            "patient_name": None,
            "doctor_name": None,
            "clinic_or_hospital": None,
            "prescription_date": None,
            "diagnosis_text": None,
        }]
        mock_meds = [
            {"name": "Amoxicillin", "dosage": None, "frequency": None, "duration": None, "instructions": None}
        ]

        class MockQuery:
            def __init__(self, data):
                self._data = data
            def select(self, *args, **kwargs): return self
            def eq(self, *args, **kwargs): return self
            def order(self, *args, **kwargs): return self
            def execute(self):
                class MockRes:
                    data = self._data
                return MockRes()

        class MockClient:
            def table(self, table_name):
                if table_name == "extracted_prescriptions":
                    return MockQuery(mock_rx)
                elif table_name == "extracted_medications":
                    return MockQuery(mock_meds)
                return MockQuery([])

        with patch("backend.app.services.db_service.is_supabase_configured", return_value=True), \
             patch("backend.app.services.db_service.get_supabase_admin_client", return_value=MockClient()):
            hydrated = DatabaseService.hydrate_extraction_result(doc, user_id)
            assert hydrated is not None
            assert hydrated["requires_verification"] is True
            assert hydrated["fields_requiring_verification"] == ["frequency"]
            meds = hydrated["structured_data"]["medications"]
            assert len(meds) == 1
            assert meds[0]["name"] == "Amoxicillin"
            assert meds[0]["dosage"] is None

    def test_authenticated_api_response_serialization(self):
        user_id = "test-user-api-ser"
        doc_id = "doc-test-api-ser"
        doc = {
            "id": doc_id,
            "document_id": doc_id,
            "user_id": user_id,
            "original_filename": "rx.pdf",
            "document_type": "prescription",
            "status": "extracted",
            "raw_text": "Sample prescription text",
            "confidence": 0.98,
            "requires_verification": False,
            "fields_requiring_verification": [],
            "created_at": "2026-11-17T00:00:00Z",
            "updated_at": "2026-11-17T00:00:00Z",
        }

        mock_rx = [{
            "patient_name": "Arthur Dent",
            "doctor_name": "Dr. Sarah Jenkins",
            "clinic_or_hospital": "Metro Clinic",
            "prescription_date": "10/11/2026",
            "diagnosis_text": "Acute Pharyngitis",
        }]
        mock_meds = [
            {"name": "Amoxicillin", "dosage": "500mg", "frequency": "TID", "duration": "7 days", "instructions": "after meals"},
        ]

        class MockQuery:
            def __init__(self, data):
                self._data = data
            def select(self, *args, **kwargs): return self
            def eq(self, *args, **kwargs): return self
            def order(self, *args, **kwargs): return self
            def execute(self):
                class MockRes:
                    data = self._data
                return MockRes()

        class MockClient:
            def table(self, table_name):
                if table_name == "extracted_prescriptions":
                    return MockQuery(mock_rx)
                elif table_name == "extracted_medications":
                    return MockQuery(mock_meds)
                return MockQuery([])

        with patch("backend.app.services.db_service.is_supabase_configured", return_value=True), \
             patch("backend.app.services.db_service.get_supabase_admin_client", return_value=MockClient()):
            detail = DocumentService._build_detail_response(doc)
            assert detail.extraction_result is not None
            assert detail.extraction_result.document_type == DocumentType.PRESCRIPTION
            assert len(detail.extraction_result.structured_data.medications) == 1
            assert detail.extraction_result.structured_data.medications[0].name == "Amoxicillin"


def mock_open_metadata(data):
    from unittest.mock import mock_open
    return mock_open(read_data=json.dumps(data))

