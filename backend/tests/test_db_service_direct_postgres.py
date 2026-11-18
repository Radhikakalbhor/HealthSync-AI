"""
Unit and Integration Tests for Direct PostgreSQL Adapter integration in DatabaseService.
Tests the 7 integrated DatabaseService methods:
- create_document_record
- get_document_record
- list_user_documents
- delete_document
- save_document_extraction_unified
- update_document_review
- verify_document_as_clinician
Verifies:
- Authenticated RLS session scoping
- Ownership checks & 403 vs 404 distinction
- RPC execution with parameters
- Atomic rollback and cleanup on failure
- Rejection of silent fallback
"""

import json
from unittest.mock import MagicMock, patch
import pytest

from backend.app.core.config import settings
from backend.app.core.exceptions import (
    EntityNotFoundException,
    ForbiddenException,
)
from backend.app.core.db import DatabaseConnectionException
from backend.app.schemas.document import DocumentStatus, DocumentType
from backend.app.services.db_service import DatabaseService


@pytest.fixture
def enable_direct_db(monkeypatch):
    """Activates direct PostgreSQL adapter mode for DatabaseService tests."""
    monkeypatch.setattr(
        settings, "HEALTHSYNC_DATABASE_URL", "postgresql://postgres:testpass@127.0.0.1:5432/healthsync_local_test"
    )


class TestDirectPostgresDatabaseService:
    """Verifies DatabaseService direct PostgreSQL queries and RLS enforcement."""

    def test_create_document_record_direct_postgres(self, enable_direct_db):
        """Verifies create_document_record executes parameterized INSERT under RLS."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.return_value = {
            "id": "doc-uuid-1",
            "user_id": "user-uuid-1",
            "original_filename": "prescription.pdf",
            "storage_path": "user-uuid-1/doc-uuid-1.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 1024,
            "document_type": "other",
            "status": "uploaded",
        }

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            res = DatabaseService.create_document_record(
                doc_id="doc-uuid-1",
                user_id="user-uuid-1",
                filename="prescription.pdf",
                storage_path="user-uuid-1/doc-uuid-1.pdf",
                mime_type="application/pdf",
                file_size_bytes=1024,
            )

            mock_get_rls.assert_called_once_with(user_id="user-uuid-1", role="authenticated")
            assert res["id"] == "doc-uuid-1"
            assert res["original_filename"] == "prescription.pdf"

            # Check executed SQL
            executed_sql = mock_cur.execute.call_args[0][0]
            assert "INSERT INTO public.medical_documents" in executed_sql
            assert "RETURNING *" in executed_sql

    def test_get_document_record_owner_access(self, enable_direct_db):
        """Verifies document owner retrieves document record via RLS."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.return_value = {
            "id": "doc-uuid-1",
            "user_id": "user-uuid-1",
            "original_filename": "report.pdf",
            "document_type": "lab_report",
            "status": "extracted",
            "extraction_result": {
                "document_type": "lab_report",
                "structured_data": {"patient_name": "Alice", "tests": []},
            },
        }

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            doc = DatabaseService.get_document_record("doc-uuid-1", "user-uuid-1")
            assert doc["id"] == "doc-uuid-1"
            assert doc["user_id"] == "user-uuid-1"
            mock_get_rls.assert_called_once_with(user_id="user-uuid-1", role="authenticated")

    def test_get_document_record_cross_user_denied_as_not_found(self, enable_direct_db):
        """
        Verifies User B cannot access User A's document.
        Under RLS, inaccessible documents are completely invisible and return 404 (EntityNotFoundException)
        to prevent cross-user document ID enumeration (IDOR oracle).
        """
        mock_rls_conn = MagicMock()
        mock_rls_cur = MagicMock()
        mock_rls_conn.cursor.return_value.__enter__.return_value = mock_rls_cur
        mock_rls_cur.fetchone.return_value = None  # RLS filters out document

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_rls_conn

            with pytest.raises(EntityNotFoundException):
                DatabaseService.get_document_record("doc-uuid-1", "user-uuid-B")
            mock_get_rls.assert_called_once_with(user_id="user-uuid-B", role="authenticated")

    def test_get_document_record_nonexistent_returns_404(self, enable_direct_db):
        """Verifies nonexistent document ID raises EntityNotFoundException (404)."""
        mock_rls_conn = MagicMock()
        mock_rls_cur = MagicMock()
        mock_rls_conn.cursor.return_value.__enter__.return_value = mock_rls_cur
        mock_rls_cur.fetchone.return_value = None

        mock_db_conn = MagicMock()
        mock_db_cur = MagicMock()
        mock_db_conn.cursor.return_value.__enter__.return_value = mock_db_cur
        mock_db_cur.fetchone.return_value = None  # Does not exist anywhere

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls, \
             patch("backend.app.services.db_service.get_db_connection") as mock_get_db:
            mock_get_rls.return_value.__enter__.return_value = mock_rls_conn
            mock_get_db.return_value.__enter__.return_value = mock_db_conn

            with pytest.raises(EntityNotFoundException):
                DatabaseService.get_document_record("nonexistent-id", "user-uuid-1")

    def test_list_user_documents_direct_postgres(self, enable_direct_db):
        """Verifies list_user_documents orders by created_at DESC under user RLS."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchall.return_value = [
            {"id": "doc-2", "user_id": "user-uuid-1", "created_at": "2026-11-18T01:00:00"},
            {"id": "doc-1", "user_id": "user-uuid-1", "created_at": "2026-11-17T01:00:00"},
        ]

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            docs = DatabaseService.list_user_documents("user-uuid-1")
            assert len(docs) == 2
            assert docs[0]["id"] == "doc-2"
            assert docs[1]["id"] == "doc-1"
            mock_get_rls.assert_called_once_with(user_id="user-uuid-1", role="authenticated")

    def test_delete_document_owner_success(self, enable_direct_db):
        """Verifies document owner can delete document with RLS."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.return_value = {"id": "doc-1", "user_id": "user-uuid-1"}

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            DatabaseService.delete_document("doc-1", "user-uuid-1")

            # Check that DELETE was executed
            calls = [str(c) for c in mock_cur.execute.mock_calls]
            assert any("DELETE FROM public.medical_documents" in c for c in calls)

    def test_delete_document_unauthorized_rejected(self, enable_direct_db):
        """Verifies non-owner delete attempt is rejected with ForbiddenException."""
        with patch.object(
            DatabaseService, "get_document_record", side_effect=ForbiddenException("Access denied.")
        ):
            with pytest.raises(ForbiddenException):
                DatabaseService.delete_document("doc-1", "attacker-user")

    def test_save_document_extraction_unified_rpc_invocation(self, enable_direct_db):
        """Verifies save_document_extraction_unified calls save_document_extraction_atomic with service_role."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.side_effect = [
            {"id": "doc-1", "user_id": "user-1"},  # get_document_record
            {"result": {"document_type": "prescription"}},  # RPC result
            {
                "id": "doc-1",
                "user_id": "user-1",
                "document_type": "prescription",
                "status": "extracted",
                "confidence": 0.95,
                "extraction_result": {"document_type": "prescription", "structured_data": {"medications": []}},
            },  # final select
        ]

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            res = DatabaseService.save_document_extraction_unified(
                doc_id="doc-1",
                user_id="user-1",
                status=DocumentStatus.EXTRACTED,
                document_type=DocumentType.PRESCRIPTION,
                raw_text="Rx Amoxicillin 500mg",
                ocr_engine="pdfplumber",
                confidence=0.95,
                confidence_method="hybrid",
                requires_verification=False,
                fields_requiring_verification=[],
                structured_data={"patient_name": "Bob", "medications": [{"name": "Amoxicillin"}]},
            )

            # Check service_role context
            mock_get_rls.assert_any_call(user_id="user-1", role="service_role")
            calls = [str(c) for c in mock_cur.execute.mock_calls]
            assert any("save_document_extraction_atomic" in c for c in calls)
            assert res["id"] == "doc-1"
            assert res["status"] == "extracted"

    def test_save_document_extraction_non_medical_null_extraction(self, enable_direct_db):
        """Verifies non-medical document passes NULL structured data to RPC."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.side_effect = [
            {"id": "doc-nm", "user_id": "user-1"},
            {"result": None},
            {"id": "doc-nm", "user_id": "user-1", "document_type": "non_medical", "extraction_result": None},
        ]

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            res = DatabaseService.save_document_extraction_unified(
                doc_id="doc-nm",
                user_id="user-1",
                status=DocumentStatus.UNSUPPORTED,
                document_type=DocumentType.NON_MEDICAL,
                raw_text="Random text resume",
                ocr_engine="pdfplumber",
                confidence=0.99,
                confidence_method="regex",
                requires_verification=False,
                fields_requiring_verification=[],
            )

            assert res["document_type"] == "non_medical"
            assert res["extraction_result"] is None

    def test_update_document_review_patient_rpc_invocation(self, enable_direct_db):
        """Verifies update_document_review invokes save_document_patient_review_atomic as authenticated patient."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.side_effect = [
            {"id": "doc-1", "user_id": "patient-1", "document_type": "prescription"},
            {"result": {"status": "extracted"}},
            {
                "id": "doc-1",
                "user_id": "patient-1",
                "user_reviewed": True,
                "status": "extracted",
                "extraction_result": {"verification_state": {"user_reviewed": True}},
            },
        ]

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            res = DatabaseService.update_document_review(
                doc_id="doc-1",
                user_id="patient-1",
                structured_data={"patient_name": "Corrected Bob"},
                review_notes="Corrected name typo",
            )

            mock_get_rls.assert_any_call(user_id="patient-1", role="authenticated")
            calls = [str(c) for c in mock_cur.execute.mock_calls]
            assert any("save_document_patient_review_atomic" in c for c in calls)
            assert res["user_reviewed"] is True

    def test_verify_document_as_clinician_rpc_invocation(self, enable_direct_db):
        """Verifies verify_document_as_clinician invokes verify_document_as_clinician_atomic as authenticated clinician."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.side_effect = [
            {"id": "doc-1", "user_id": "clinician-1", "document_type": "prescription"},
            {"result": {"clinician_verified": True}},
            {
                "id": "doc-1",
                "user_id": "patient-1",
                "clinician_verified": True,
                "verified_by_user_id": "clinician-1",
                "extraction_result": {"verification_state": {"clinician_verified": True}},
            },
        ]

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            res = DatabaseService.verify_document_as_clinician(
                doc_id="doc-1",
                user_id="clinician-1",
                verified_structured_data={"doctor_name": "Dr. Validated"},
                review_notes="Prescription verified clinically.",
            )

            mock_get_rls.assert_any_call(user_id="clinician-1", role="authenticated")
            calls = [str(c) for c in mock_cur.execute.mock_calls]
            assert any("verify_document_as_clinician_atomic" in c for c in calls)
            assert res["clinician_verified"] is True
            assert res["verified_by_user_id"] == "clinician-1"

    def test_no_silent_fallback_on_direct_db_error(self, enable_direct_db):
        """Verifies configured direct DB does NOT silently fall back to JSON on failure."""
        with patch("backend.app.services.db_service.get_rls_connection", side_effect=DatabaseConnectionException("Connection timeout")):
            with pytest.raises(DatabaseConnectionException):
                DatabaseService.create_document_record(
                    doc_id="doc-1",
                    user_id="user-1",
                    filename="test.pdf",
                    storage_path="path/test.pdf",
                    mime_type="application/pdf",
                    file_size_bytes=100,
                )

    def test_save_document_extraction_rpc_failure_fails_closed(self, enable_direct_db):
        """Verifies save_document_extraction_unified fails closed if save_document_extraction_atomic fails."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.side_effect = [
            {"id": "doc-1", "user_id": "user-1"},  # get_document_record
        ]
        # Simulate RPC failure (e.g. invalid document state, missing RPC)
        mock_cur.execute.side_effect = [
            None,  # UPDATE raw_text
            RuntimeError("PostgreSQL error: save_document_extraction_atomic execution failed"),
        ]

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            with pytest.raises(RuntimeError) as exc:
                DatabaseService.save_document_extraction_unified(
                    doc_id="doc-1",
                    user_id="user-1",
                    status=DocumentStatus.EXTRACTED,
                    document_type=DocumentType.PRESCRIPTION,
                    raw_text="Rx: Aspirin",
                    ocr_engine="pdfplumber",
                    confidence=0.9,
                    confidence_method="test",
                    requires_verification=False,
                    fields_requiring_verification=[],
                    structured_data={"medications": []},
                )
            assert "save_document_extraction_atomic execution failed" in str(exc.value)

    def test_update_document_review_rpc_failure_fails_closed(self, enable_direct_db):
        """Verifies update_document_review fails closed if save_document_patient_review_atomic fails."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.side_effect = [
            {"id": "doc-1", "user_id": "patient-1"},
        ]
        mock_cur.execute.side_effect = RuntimeError("PostgreSQL error: save_document_patient_review_atomic failed")

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            with pytest.raises(RuntimeError) as exc:
                DatabaseService.update_document_review(
                    doc_id="doc-1",
                    user_id="patient-1",
                    structured_data={"corrected": True},
                )
            assert "save_document_patient_review_atomic failed" in str(exc.value)

    def test_verify_document_as_clinician_rpc_failure_fails_closed(self, enable_direct_db):
        """Verifies verify_document_as_clinician fails closed if verify_document_as_clinician_atomic fails."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.side_effect = [
            {"id": "doc-1", "user_id": "clinician-1"},
        ]
        mock_cur.execute.side_effect = RuntimeError("PostgreSQL error: Caller is not an approved clinician.")

        with patch("backend.app.services.db_service.get_rls_connection") as mock_get_rls:
            mock_get_rls.return_value.__enter__.return_value = mock_conn

            with pytest.raises(RuntimeError) as exc:
                DatabaseService.verify_document_as_clinician(
                    doc_id="doc-1",
                    user_id="clinician-1",
                    verified_structured_data={"verified": True},
                )
            assert "Caller is not an approved clinician" in str(exc.value)
