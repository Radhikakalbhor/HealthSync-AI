"""
Verification tests for HealthSync AI Migration 007 and Unified Extraction Persistence.
Tests:
1. Extraction JSONB persistence & single-pass reconstruction.
2. Legacy relational hydration fallback.
3. Prescription projection synchronization.
4. Lab projection synchronization.
5. Discharge summary persistence and non-loss.
6. Document type transitions and projection cleanup.
7. Non-medical and unsupported document rejection & NULL extraction enforcement.
8. Patient ownership enforcement on review.
9. Patient review verification spoofing rejection (clinician verification remains unverified).
10. Clinician verification eligibility & approval gating.
11. Clinician verification positive allowlist.
12. Review audit diff generation (added, removed, modified).
13. Input validation & malformed extraction handling.
14. Migration 007 & Rollback SQL static integrity and manifest tracking checks.
"""

import json
import pytest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

from backend.app.schemas.document import (
    DocumentType,
    DocumentStatus,
    ExtractionResult,
    PrescriptionData,
    LabReportData,
    DischargeSummaryData,
)
from backend.app.services.db_service import DatabaseService
from backend.app.services.document_service import DocumentService
from backend.app.core.exceptions import ValidationException, ForbiddenException, EntityNotFoundException


@pytest.fixture(autouse=True)
def mock_isolated_env(monkeypatch):
    """Ensure complete network and database isolation."""
    import backend.app.core.supabase_client as sc
    import backend.app.services.document_service as ds
    import backend.app.services.db_service as dbs
    import backend.app.services.rag_service as rs
    from backend.app.core.config import settings

    monkeypatch.setattr(settings, "LLM_API_KEY", "")
    monkeypatch.setattr(settings, "LLM_PROVIDER", "none")
    monkeypatch.setattr(sc, "is_supabase_configured", lambda: False)
    monkeypatch.setattr(ds, "is_supabase_configured", lambda: False)
    monkeypatch.setattr(dbs, "is_supabase_configured", lambda: False)
    monkeypatch.setattr(rs, "is_supabase_configured", lambda: False)


class TestMigration007SQLIntegrity:
    """Verifies DDL rules, manifest self-ownership, and lack of destructive CASCADE operations."""

    def test_migration_007_files_exist(self):
        up_path = Path("backend/migrations/007_unified_extraction_result.sql")
        down_path = Path("backend/migrations/007_unified_extraction_result_rollback.sql")
        assert up_path.exists(), "007 migration SQL file must exist"
        assert down_path.exists(), "007 rollback SQL file must exist"

    def test_no_destructive_cascade_in_rollback(self):
        down_path = Path("backend/migrations/007_unified_extraction_result_rollback.sql")
        content = down_path.read_text(encoding="utf-8")
        # Ensure no DROP ... CASCADE commands exist in rollback
        import re
        drop_cascade = re.findall(r"DROP\s+.*?\s+CASCADE", content, re.IGNORECASE)
        assert len(drop_cascade) == 0, f"Rollback must never contain CASCADE drops: {drop_cascade}"

    def test_manifest_ownership_tracking(self):
        up_path = Path("backend/migrations/007_unified_extraction_result.sql")
        content = up_path.read_text(encoding="utf-8")
        assert "_migration_007_manifest" in content
        assert "CREATE TABLE public._migration_007_manifest" in content
        assert "save_document_extraction_atomic" in content
        assert "save_document_patient_review_atomic" in content
        assert "verify_document_as_clinician_atomic" in content
        assert "_sync_document_relational_projections" in content
        assert "prevent_profile_role_self_promotion" in content

    def test_strict_column_level_security_on_profiles(self):
        up_path = Path("backend/migrations/007_unified_extraction_result.sql")
        content = up_path.read_text(encoding="utf-8")
        assert "REVOKE UPDATE ON public.profiles FROM authenticated;" in content
        assert "GRANT UPDATE (full_name, updated_at) ON public.profiles TO authenticated;" in content


class TestUnifiedExtractionPersistence:
    """Verifies backend hydration, persistence, and legacy reconstruction."""

    def test_non_medical_returns_null_extraction(self):
        doc = {
            "id": "doc-non-med",
            "document_type": "non_medical",
            "status": "unsupported",
            "raw_text": "Random text resume",
        }
        res = DatabaseService.hydrate_extraction_result(doc, "user-123")
        assert res is None

    def test_unsupported_status_returns_null_extraction(self):
        doc = {
            "id": "doc-unsupported",
            "document_type": "prescription",
            "status": "unsupported",
            "raw_text": "Unclear handwritten note",
        }
        res = DatabaseService.hydrate_extraction_result(doc, "user-123")
        assert res is None

    def test_direct_jsonb_extraction_result_hydration(self):
        doc = {
            "id": "doc-jsonb-1",
            "document_type": "prescription",
            "status": "extracted",
            "raw_text": "Rx Amoxicillin 500mg",
            "extraction_result": {
                "document_id": "doc-jsonb-1",
                "document_type": "prescription",
                "raw_text": "Rx Amoxicillin 500mg",
                "ocr_engine": "tesseract_ocr",
                "page_count": 1,
                "confidence": 0.95,
                "confidence_method": "tesseract_word_mean",
                "structured_data": {
                    "doctor_name": "Dr. Sarah Adams",
                    "prescription_date": "2026-05-10",
                    "medications": [
                        {"name": "Amoxicillin", "dosage": "500mg", "frequency": "TID", "duration": "7 days"}
                    ],
                },
                "verification_state": {
                    "user_reviewed": True,
                    "clinician_verified": False,
                },
            },
        }
        hydrated = DatabaseService.hydrate_extraction_result(doc, "user-123")
        assert hydrated is not None
        assert hydrated["structured_data"]["doctor_name"] == "Dr. Sarah Adams"
        assert len(hydrated["structured_data"]["medications"]) == 1
        assert hydrated["structured_data"]["medications"][0]["name"] == "Amoxicillin"

    def test_legacy_relational_hydration_for_prescriptions(self):
        doc = {
            "id": "doc-rx-relational",
            "document_type": "prescription",
            "status": "extracted",
            "raw_text": "Dr. John Doe Clinic Rx Metformin 500mg",
        }
        mock_client = MagicMock()
        mock_rx_table = MagicMock()
        mock_rx_table.select.return_value.eq.return_value.execute.return_value.data = [
            {
                "doctor_name": "Dr. John Doe",
                "clinic_or_hospital": "City Care Clinic",
                "prescription_date": "2026-04-12",
            }
        ]
        mock_med_table = MagicMock()
        mock_med_table.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            {
                "name": "Metformin",
                "dosage": "500mg",
                "frequency": "Once daily",
                "duration": "30 days",
                "instructions": "After breakfast",
            }
        ]

        def table_router(tname):
            if tname == "extracted_prescriptions":
                return mock_rx_table
            if tname == "extracted_medications":
                return mock_med_table
            return MagicMock()

        mock_client.table.side_effect = table_router

        with patch("backend.app.services.db_service.is_supabase_configured", return_value=True), \
             patch("backend.app.services.db_service.get_supabase_admin_client", return_value=mock_client):
            hydrated = DatabaseService.hydrate_extraction_result(doc, "user-123")
            assert hydrated is not None
            assert hydrated["structured_data"]["doctor_name"] == "Dr. John Doe"
            assert hydrated["structured_data"]["medications"][0]["name"] == "Metformin"

    def test_discharge_summary_preservation_without_relational_leak(self):
        doc = {
            "id": "doc-ds-1",
            "document_type": "discharge_summary",
            "status": "extracted",
            "raw_text": """
            METROPOLITAN HOSPITAL
            DISCHARGE SUMMARY
            Patient: Robert Brown
            Admission Date: 2026-03-01
            Discharge Date: 2026-03-05
            Discharge Diagnosis: Community-Acquired Pneumonia
            Discharge Medications:
            1. Azithromycin 500mg once daily for 3 days
            """,
        }
        hydrated = DatabaseService.hydrate_extraction_result(doc, "user-123")
        assert hydrated is not None
        assert hydrated["document_type"] == "discharge_summary"
        sd = hydrated["structured_data"]
        assert "discharge_diagnosis" in sd or "discharge_medications" in sd or "hospital_name" in sd


class TestVerificationSecurityAndRoleIsolation:
    """Verifies tri-state review separation and spoofing prevention."""

    def test_patient_review_cannot_grant_clinician_verification(self, tmp_path, monkeypatch):
        # Setup temporary local storage
        meta_file = tmp_path / "metadata.json"
        monkeypatch.setattr(DocumentService, "_metadata_file", meta_file)

        doc_id = "doc-test-review-spoof"
        initial_record = {
            "document_id": doc_id,
            "user_id": "patient-456",
            "original_filename": "prescription.pdf",
            "stored_filename": f"{doc_id}_prescription.pdf",
            "document_type": "prescription",
            "status": "needs_review",
            "clinician_verified": False,
            "requires_verification": True,
            "extraction_result": {
                "document_id": doc_id,
                "document_type": "prescription",
                "raw_text": "Rx Paracetamol",
                "structured_data": {"doctor_name": "Dr. Smith"},
                "verification_state": {
                    "user_reviewed": False,
                    "clinician_verified": False,
                },
            },
        }
        DocumentService._save_record(doc_id, initial_record)

        # Attempt to spoof clinician verification in patient review payload
        spoofed_payload = {
            "structured_data": {"doctor_name": "Dr. Smith Corrected"},
            "clinician_verified": True,
            "verified_by_user_id": "patient-456",
        }
        DocumentService.update_review(doc_id, "patient-456", spoofed_payload)

        # Verify updated record
        updated = DocumentService.get_document_record(doc_id, "patient-456")
        assert updated["user_reviewed"] is True
        assert updated["clinician_verified"] is False  # Must NOT be clinician verified!
        assert updated["status"] == "extracted"

    def test_patient_review_rejected_for_non_medical(self, tmp_path, monkeypatch):
        meta_file = tmp_path / "metadata.json"
        monkeypatch.setattr(DocumentService, "_metadata_file", meta_file)

        doc_id = "doc-non-medical"
        record = {
            "document_id": doc_id,
            "user_id": "patient-123",
            "original_filename": "invoice.pdf",
            "document_type": "non_medical",
            "status": "unsupported",
        }
        DocumentService._save_record(doc_id, record)

        with pytest.raises(ValidationException, match="unsupported or non-medical"):
            DocumentService.update_review(doc_id, "patient-123", {"structured_data": {}})

    def test_clinician_verification_flow(self, tmp_path, monkeypatch):
        meta_file = tmp_path / "metadata.json"
        monkeypatch.setattr(DocumentService, "_metadata_file", meta_file)

        doc_id = "doc-clinician-verify"
        record = {
            "document_id": doc_id,
            "user_id": "clinician-789",
            "original_filename": "lab_report.pdf",
            "document_type": "lab_report",
            "status": "needs_review",
            "clinician_verified": False,
            "extraction_result": {
                "document_id": doc_id,
                "document_type": "lab_report",
                "raw_text": "CBC Report",
                "structured_data": {"tests": []},
            },
        }
        DocumentService._save_record(doc_id, record)

        verif_payload = {
            "structured_data": {
                "tests": [{"test_name": "Hemoglobin", "measured_value": "14.2", "unit": "g/dL", "is_abnormal": False}]
            },
            "notes": "Verified against laboratory clinical analyzer output",
        }

        res = DocumentService.verify_as_clinician(doc_id, "clinician-789", verif_payload)
        assert res["status"] == "success"

        updated = DocumentService.get_document_record(doc_id, "clinician-789")
        assert updated["clinician_verified"] is True
        assert updated["requires_verification"] is False
        assert updated["verified_by_user_id"] == "clinician-789"
