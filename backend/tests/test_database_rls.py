from unittest.mock import MagicMock, patch
import pytest

from backend.app.core.exceptions import (
    EntityNotFoundException,
    ForbiddenException,
    SupabaseNotConfiguredException,
)
from backend.app.schemas.document import (
    DocumentType,
    DocumentStatus,
    MedicationItem,
    PrescriptionData,
    LabTestItem,
    LabReportData,
)
from backend.app.services.db_service import DatabaseService
from backend.app.services.storage_service import StorageService
from backend.app.services.auth_service import AuthService


# ==============================================================================
# Mocked Database Operations (Tests database persistence layer without requiring live Supabase credentials)
# ==============================================================================

def test_mocked_create_and_query_document():
    """Tests document creation in Supabase PostgreSQL via mocked client."""
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.insert.return_value.execute.return_value.data = [
        {
            "id": "doc-uuid-101",
            "user_id": "user-uuid-202",
            "original_filename": "blood_panel.pdf",
            "storage_path": "user-uuid-202/doc-uuid-101/blood_panel.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 10240,
            "status": "uploaded",
        }
    ]

    with patch("backend.app.services.db_service.is_supabase_configured", return_value=True), \
         patch("backend.app.services.db_service.get_supabase_admin_client", return_value=mock_client):
        record = DatabaseService.create_document_record(
            doc_id="doc-uuid-101",
            user_id="user-uuid-202",
            filename="blood_panel.pdf",
            storage_path="user-uuid-202/doc-uuid-101/blood_panel.pdf",
            mime_type="application/pdf",
            file_size_bytes=10240,
        )

        assert record["id"] == "doc-uuid-101"
        assert record["user_id"] == "user-uuid-202"
        mock_client.table.assert_called_with("medical_documents")


def test_mocked_save_prescription_entities():
    """Tests saving relational prescription entities into extracted_prescriptions and extracted_medications."""
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    # Mock insert returning generated prescription ID
    mock_table.insert.return_value.execute.return_value.data = [{"id": "rx-generated-id-555"}]

    rx_data = PrescriptionData(
        patient_name="Diana Prince",
        doctor_name="Dr. Banner",
        clinic_or_hospital="Metropolis Health",
        medications=[
            MedicationItem(name="Amoxicillin", dosage="500mg", frequency="TID")
        ],
        diagnosis_text="Bacterial Pharyngitis",
    )

    with patch("backend.app.services.db_service.is_supabase_configured", return_value=True), \
         patch("backend.app.services.db_service.get_supabase_admin_client", return_value=mock_client):
        rx_id = DatabaseService.save_prescription_entities(
            doc_id="doc-uuid-101",
            user_id="user-uuid-202",
            data=rx_data,
        )

        assert rx_id == "rx-generated-id-555"
        # Verify both extracted_prescriptions and extracted_medications were targeted
        table_calls = [c[0][0] for c in mock_client.table.call_args_list]
        assert "extracted_prescriptions" in table_calls
        assert "extracted_medications" in table_calls


def test_mocked_save_lab_report_entities():
    """Tests saving relational lab report and individual test results."""
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.insert.return_value.execute.return_value.data = [{"id": "lab-generated-id-777"}]

    lab_data = LabReportData(
        patient_name="Barry Allen",
        doctor_or_lab_name="Central City Labs",
        report_date="2026-11-16",
        tests=[
            LabTestItem(test_name="Glucose", measured_value="95", unit="mg/dL", reference_range="70-99", is_abnormal=False),
            LabTestItem(test_name="HbA1c", measured_value="7.2", unit="%", reference_range="4.0-5.6", is_abnormal=True),
        ],
    )

    with patch("backend.app.services.db_service.is_supabase_configured", return_value=True), \
         patch("backend.app.services.db_service.get_supabase_admin_client", return_value=mock_client):
        lab_id = DatabaseService.save_lab_report_entities(
            doc_id="doc-uuid-101",
            user_id="user-uuid-202",
            data=lab_data,
        )

        assert lab_id == "lab-generated-id-777"
        table_calls = [c[0][0] for c in mock_client.table.call_args_list]
        assert "extracted_lab_reports" in table_calls
        assert "extracted_lab_results" in table_calls


# ==============================================================================
# Mocked Storage Operations
# ==============================================================================

@pytest.mark.anyio
async def test_mocked_storage_upload_and_signed_url():
    """Tests private bucket upload and signed URL generation with ownership verification."""
    mock_client = MagicMock()
    mock_storage = MagicMock()
    mock_client.storage.from_.return_value = mock_storage
    mock_storage.upload.return_value = {"Key": "medical-documents/user-1/doc-1/file.pdf"}
    mock_storage.create_signed_url.return_value = {"signedURL": "https://supabase.co/storage/v1/object/sign/..."}

    with patch("backend.app.services.storage_service.is_supabase_configured", return_value=True), \
         patch("backend.app.services.storage_service.get_supabase_admin_client", return_value=mock_client):

        # 1. Upload
        path = await StorageService.upload_file(
            user_id="user-1",
            document_id="doc-1",
            filename="prescription.pdf",
            file_bytes=b"%PDF-test",
            mime_type="application/pdf",
        )
        assert path == "user-1/doc-1/prescription.pdf"

        # 2. Signed URL
        signed_url = StorageService.create_signed_url(
            storage_path=path,
            user_id="user-1",
            expires_in_seconds=1800,
        )
        assert "https://supabase.co" in signed_url

        # 3. Ownership violation raises ForbiddenException
        with pytest.raises(ForbiddenException):
            StorageService.create_signed_url(
                storage_path=path,
                user_id="user-attacker-999",
            )


# ==============================================================================
# Mocked Auth Operations
# ==============================================================================

@pytest.mark.anyio
async def test_mocked_auth_register_and_login():
    """Tests user registration and login workflows against mocked Supabase Auth."""
    mock_client = MagicMock()
    mock_auth = MagicMock()
    mock_client.auth = mock_auth

    # Mock signup response
    mock_user = MagicMock()
    mock_user.id = "new-user-uuid-333"
    mock_user.email = "test@healthsync.ai"
    mock_auth.sign_up.return_value = MagicMock(user=mock_user)

    # Mock signin response
    mock_session = MagicMock()
    mock_session.access_token = "mock.supabase.jwt"
    mock_session.token_type = "bearer"
    mock_session.expires_in = 3600
    mock_session.refresh_token = "mock-refresh-token"
    mock_auth.sign_in_with_password.return_value = MagicMock(session=mock_session, user=mock_user)

    with patch("backend.app.services.auth_service.is_supabase_configured", return_value=True), \
         patch("backend.app.services.auth_service.get_supabase_client", return_value=mock_client):

        # Register
        reg_res = await AuthService.register_user("test@healthsync.ai", "Password123!", "Test User")
        assert reg_res.id == "new-user-uuid-333"
        assert reg_res.email == "test@healthsync.ai"

        # Login
        login_res = await AuthService.login_user("test@healthsync.ai", "Password123!")
        assert login_res.access_token == "mock.supabase.jwt"
        assert login_res.user_id == "new-user-uuid-333"
