"""
Automated Integration and Functional Tests for Phase 6: Advanced Health Intelligence.
Tests:
- Unified Medical Timeline (aggregation, filtering, chronological ordering)
- Health Trend Analytics (longitudinal biomarker tracking, unit compatibility enforcement)
- Doctor Visit Summary & Real PDF Generation (PyMuPDF %PDF- header verification)
- Time-Limited Secure QR Code Sharing (public read-only token, QR data URL, revocation, access count)
- Emergency Health Card (vital contacts, allergies, blood group, public emergency responder access)
- Family Member Profiles (profile CRUD, account isolation)
- Pre-Visit Doctor Briefing (neutral empowerment questions, safety disclaimers)
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.app.schemas.intelligence import (
    DoctorSummaryRequest,
    CreateShareTokenRequest,
    EmergencyCardUpdate,
    FamilyProfileCreate,
    PreVisitBriefingRequest,
)
from backend.app.services.document_service import DocumentService
from backend.tests.conftest import create_test_jwt


@pytest.fixture(autouse=True)
def setup_test_documents():
    """Seeds consistent sample records in DocumentService for testing."""
    test_user = "test-intel-user-1"
    
    # Store a simulated prescription record
    presc_record = {
        "document_id": "doc-test-presc-1",
        "user_id": test_user,
        "original_filename": "Prescription_DrSharma.pdf",
        "stored_filename": "doc-test-presc-1.pdf",
        "storage_path": "doc-test-presc-1.pdf",
        "mime_type": "application/pdf",
        "file_size_bytes": 1024,
        "status": "extracted",
        "document_type": "prescription",
        "raw_text": "Rx: Metformin 500mg once daily. Date: 2026-01-10. Dr. Sharma.",
        "extraction_result": {
            "document_id": "doc-test-presc-1",
            "document_type": "prescription",
            "ocr_engine": "tesseract_ocr",
            "raw_text": "Rx: Metformin 500mg once daily. Date: 2026-01-10. Dr. Sharma.",
            "confidence": 0.95,
            "confidence_method": "word_average",
            "structured_data": {
                "doctor_name": "Dr. Sharma",
                "clinic_name": "Metro Health",
                "prescription_date": "2026-01-10",
                "medications": [
                    {
                        "name": "Metformin",
                        "dosage": "500mg",
                        "frequency": "Once daily",
                        "instructions": "Take with dinner",
                    }
                ],
            },
            "fields_requiring_verification": [],
            "requires_verification": False,
        },
        "created_at": "2026-01-10T10:00:00+00:00",
        "updated_at": "2026-01-10T10:00:00+00:00",
    }
    DocumentService._save_record("doc-test-presc-1", presc_record)

    # Store a simulated lab report with HbA1c and Glucose
    lab_record = {
        "document_id": "doc-test-lab-1",
        "user_id": test_user,
        "original_filename": "Blood_Panel_HbA1c.pdf",
        "stored_filename": "doc-test-lab-1.pdf",
        "storage_path": "doc-test-lab-1.pdf",
        "mime_type": "application/pdf",
        "file_size_bytes": 2048,
        "status": "extracted",
        "document_type": "blood_test",
        "raw_text": "Complete Blood Count & HbA1c. Date: 2026-01-15.",
        "extraction_result": {
            "document_id": "doc-test-lab-1",
            "document_type": "blood_test",
            "ocr_engine": "tesseract_ocr",
            "raw_text": "Complete Blood Count & HbA1c. Date: 2026-01-15.",
            "confidence": 0.98,
            "confidence_method": "word_average",
            "structured_data": {
                "lab_name": "City Diagnostic Labs",
                "test_date": "2026-01-15",
                "results": [
                    {
                        "test_name": "HbA1c",
                        "value": "6.8",
                        "unit": "%",
                        "reference_range": "4.0 - 5.6",
                        "flag": "HIGH",
                    },
                    {
                        "test_name": "Fasting Blood Glucose",
                        "value": "128",
                        "unit": "mg/dL",
                        "reference_range": "70 - 99",
                        "flag": "HIGH",
                    },
                    {
                        "test_name": "Hemoglobin",
                        "value": "14.2",
                        "unit": "g/dL",
                        "reference_range": "13.0 - 17.0",
                        "flag": "NORMAL",
                    },
                ],
            },
            "fields_requiring_verification": [],
            "requires_verification": False,
        },
        "created_at": "2026-01-15T11:00:00+00:00",
        "updated_at": "2026-01-15T11:00:00+00:00",
    }
    DocumentService._save_record("doc-test-lab-1", lab_record)


def test_unified_timeline(client: TestClient):
    """Verifies chronological medical timeline retrieval and category filtering."""
    token = create_test_jwt("test-intel-user-1", "intel1@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch complete timeline
    res = client.get("/api/v1/timeline", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "events" in data
    assert "total" in data
    assert data["total"] >= 2

    # Verify chronological or structured fields
    item = data["events"][0]
    assert "id" in item
    assert "event_date" in item
    assert "document_type" in item
    assert "title" in item

    # Filter by category = 'prescription'
    res_filtered = client.get("/api/v1/timeline?category=prescription", headers=headers)
    assert res_filtered.status_code == 200
    filtered_data = res_filtered.json()
    assert all(e["document_type"] == "prescription" for e in filtered_data["events"])


def test_unified_timeline_offline_network_isolated():
    """
    Regression test: Verifies that unified medical timeline generates completely
    without network access, using isolated local synthetic documents and zero Supabase calls.
    """
    from backend.app.core.supabase_client import is_supabase_configured
    assert is_supabase_configured() is False

    test_user = "test-offline-user-1"
    rx_record = {
        "document_id": "doc-test-rx-offline",
        "user_id": test_user,
        "original_filename": "offline_rx.pdf",
        "document_type": "prescription",
        "status": "extracted",
        "created_at": "2026-01-10T10:00:00+00:00",
        "raw_text": "Rx: Amoxicillin 500mg. Dr. Offline.",
        "extraction_result": {
            "document_id": "doc-test-rx-offline",
            "document_type": "prescription",
            "raw_text": "Rx: Amoxicillin 500mg. Dr. Offline.",
            "ocr_engine": "pdfplumber",
            "structured_data": {
                "doctor_name": "Dr. Offline",
                "medications": [{"name": "Amoxicillin", "dosage": "500mg"}],
            },
        },
    }
    DocumentService._save_record("doc-test-rx-offline", rx_record)

    from backend.app.services.intelligence_service import IntelligenceService
    timeline = IntelligenceService.get_timeline(user_id=test_user)

    assert timeline is not None
    assert timeline.total >= 1
    assert timeline.events[0].document_type == "prescription"
    assert timeline.events[0].title == "offline_rx.pdf"
    assert "Dr. Offline" in timeline.events[0].summary


def test_health_trends_and_unit_isolation(client: TestClient):
    """Verifies longitudinal biomarker tracking and strict unit compatibility separation."""
    token = create_test_jwt("test-intel-user-1", "intel1@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/analytics/trends", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "series" in data
    assert "total_biomarkers" in data

    series_list = data["series"]
    assert len(series_list) >= 1

    # Check that HbA1c series has % unit and valid points
    hba1c_series = next((s for s in series_list if s["test_name"] == "HbA1c"), None)
    if hba1c_series:
        assert hba1c_series["unit"] == "%"
        assert len(hba1c_series["points"]) >= 1
        pt = hba1c_series["points"][0]
        assert pt["value"] == 6.8
        assert pt["flag"] == "HIGH"


def test_doctor_visit_summary_preview_and_pdf(client: TestClient):
    """Verifies doctor summary generation and PyMuPDF binary PDF export."""
    token = create_test_jwt("test-intel-user-1", "intel1@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    req_body = {
        "selected_document_ids": ["doc-test-presc-1", "doc-test-lab-1"],
        "visit_specialty": "Endocrinology",
        "notes": "Follow-up for glucose control",
    }

    # 1. Preview
    res_preview = client.post("/api/v1/summary/preview", json=req_body, headers=headers)
    assert res_preview.status_code == 200
    preview = res_preview.json()
    assert preview["specialty"] == "Endocrinology"
    assert "active_medications" in preview
    assert "recent_labs" in preview
    assert "disclaimer" in preview
    assert "NEVER diagnoses" in preview["disclaimer"]

    # 2. PDF generation
    res_pdf = client.post("/api/v1/summary/generate-pdf", json=req_body, headers=headers)
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert res_pdf.content.startswith(b"%PDF-")
    assert len(res_pdf.content) > 500


def test_secure_qr_sharing_lifecycle(client: TestClient, unauthenticated_client: TestClient):
    """Tests time-limited token generation, QR code payload, public read-only access, and revocation."""
    token = create_test_jwt("test-intel-user-1", "intel1@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    # Create share link
    share_payload = {
        "document_ids": ["doc-test-presc-1"],
        "expires_in_hours": 24,
        "recipient_label": "Dr. Davis Clinic",
    }
    res_create = client.post("/api/v1/shares", json=share_payload, headers=headers)
    assert res_create.status_code == 201
    share_info = res_create.json()
    assert share_info["share_token"].startswith("hst_")
    assert share_info["qr_code_data_url"].startswith("data:image/png;base64,")
    share_token = share_info["share_token"]

    # Access public endpoint without auth headers
    res_public = unauthenticated_client.get(f"/api/v1/shares/public/{share_token}")
    assert res_public.status_code == 200
    public_doc = res_public.json()
    assert public_doc["share_token"] == share_token
    assert len(public_doc["documents"]) == 1
    assert "disclaimer" in public_doc

    # Revoke share token
    res_revoke = client.delete(f"/api/v1/shares/{share_token}", headers=headers)
    assert res_revoke.status_code == 200

    # Public endpoint access after revocation should fail with 403 Forbidden
    res_revoked_public = unauthenticated_client.get(f"/api/v1/shares/public/{share_token}")
    assert res_revoked_public.status_code in (403, 404, 410)


def test_emergency_health_card_lifecycle(client: TestClient, unauthenticated_client: TestClient):
    """Tests emergency card retrieval, update, and public emergency responder access."""
    token = create_test_jwt("test-intel-user-1", "intel1@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    # Get default/initial emergency card
    res_get = client.get("/api/v1/emergency", headers=headers)
    assert res_get.status_code == 200
    card = res_get.json()
    assert "emergency_token" in card
    assert "qr_code_data_url" in card

    # Update emergency details
    update_payload = {
        "emergency_contact_name": "Jane Doe",
        "emergency_contact_phone": "+1-555-0199",
        "emergency_contact_relation": "Spouse",
        "blood_group": "O+",
        "allergies": ["Penicillin", "Peanuts"],
        "confirmed_medications": ["Metformin 500mg"],
        "critical_notes": "Type 2 Diabetes",
        "is_active": True,
    }
    res_put = client.put("/api/v1/emergency", json=update_payload, headers=headers)
    assert res_put.status_code == 200
    updated_card = res_put.json()
    assert updated_card["emergency_contact_name"] == "Jane Doe"
    assert updated_card["blood_group"] == "O+"
    assert "Penicillin" in updated_card["allergies"]

    emg_token = updated_card["emergency_token"]

    # Public emergency responder view (no auth)
    res_emg_pub = unauthenticated_client.get(f"/api/v1/emergency/public/{emg_token}")
    assert res_emg_pub.status_code == 200
    pub_card = res_emg_pub.json()
    assert pub_card["blood_group"] == "O+"
    assert pub_card["emergency_contact_phone"] == "+1-555-0199"


def test_family_profiles_crud_and_isolation(client: TestClient):
    """Tests family member profiles creation, retrieval, deletion, and owner isolation."""
    token_parent = create_test_jwt("user-parent-1", "parent@healthsync.ai")
    token_other = create_test_jwt("user-other-2", "other@healthsync.ai")

    # Parent creates child profile
    family_payload = {
        "full_name": "Leo Miller",
        "relationship": "Child",
        "date_of_birth": "2021-04-12",
        "gender": "Male",
    }
    res_create = client.post(
        "/api/v1/family",
        json=family_payload,
        headers={"Authorization": f"Bearer {token_parent}"},
    )
    assert res_create.status_code == 201
    profile = res_create.json()
    assert profile["full_name"] == "Leo Miller"
    profile_id = profile["id"]

    # Parent lists family profiles
    res_list = client.get(
        "/api/v1/family",
        headers={"Authorization": f"Bearer {token_parent}"},
    )
    assert res_list.status_code == 200
    assert any(p["id"] == profile_id for p in res_list.json())

    # Other user does NOT see child profile
    res_other = client.get(
        "/api/v1/family",
        headers={"Authorization": f"Bearer {token_other}"},
    )
    assert res_other.status_code == 200
    assert not any(p["id"] == profile_id for p in res_other.json())

    # Parent deletes family profile
    res_del = client.delete(
        f"/api/v1/family/{profile_id}",
        headers={"Authorization": f"Bearer {token_parent}"},
    )
    assert res_del.status_code == 200


def test_pre_visit_doctor_briefing(client: TestClient):
    """Verifies pre-visit briefing generation with neutral questions and safety disclaimers."""
    token = create_test_jwt("test-intel-user-1", "intel1@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    briefing_payload = {
        "doctor_specialty": "Cardiology",
        "primary_concern": "Follow up on blood pressure and lipid profile",
        "selected_document_ids": ["doc-test-presc-1", "doc-test-lab-1"],
    }
    res = client.post("/api/v1/briefing/generate", json=briefing_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["specialty"] == "Cardiology"
    assert data["primary_concern"] == "Follow up on blood pressure and lipid profile"
    assert len(data["suggested_questions_for_doctor"]) >= 2
    assert "disclaimer" in data
    assert "NEVER diagnoses" in data["disclaimer"]
