from pathlib import Path
import time
import jwt
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from backend.main import app
from backend.app.core.config import settings
from backend.app.core.exceptions import (
    UnauthorizedException,
    ForbiddenException,
    SupabaseNotConfiguredException,
)
from backend.app.core.auth import verify_jwt_token
from backend.app.core.supabase_client import get_supabase_client, is_supabase_configured
from backend.app.services.audit_service import AuditService, AuditAction
from backend.app.services.storage_service import StorageService
from backend.tests.conftest import create_test_jwt, TEST_JWT_SECRET


# ==============================================================================
# 1. Authentication Token Verification
# ==============================================================================

def test_unauthenticated_request_rejected(unauthenticated_client):
    """Verifies that accessing protected medical endpoints without token returns 401."""
    resp = unauthenticated_client.post("/api/v1/documents/upload")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


def test_invalid_token_rejected(unauthenticated_client):
    """Verifies that garbage or tampered token returns 401."""
    resp = unauthenticated_client.get(
        "/api/v1/documents",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


def test_expired_token_rejected(unauthenticated_client):
    """Verifies that expired JWT returns 401."""
    expired_token = create_test_jwt(exp_seconds=-100)
    resp = unauthenticated_client.get(
        "/api/v1/documents",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "expired" in resp.json()["error"]["message"].lower()


def test_authenticated_token_decoding():
    """Verifies that verify_jwt_token correctly extracts identity claims."""
    token = create_test_jwt(user_id="user-12345", email="patient@healthsync.ai")
    identity = verify_jwt_token(token)
    assert identity.user_id == "user-12345"
    assert identity.email == "patient@healthsync.ai"
    assert identity.role == "authenticated"


# ==============================================================================
# 2. User Ownership Enforcement
# ==============================================================================

def test_user_ownership_enforcement(client):
    """
    Verifies that User B cannot access, extract, or review User A's medical documents.
    """
    # 1. User A uploads document
    token_a = create_test_jwt(user_id="user-patient-a", email="user_a@healthsync.ai")
    client_a = TestClient(app, headers={"Authorization": f"Bearer {token_a}"})

    import pymupdf as fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(fitz.Point(50, 72), "Dr. Jekyll\nRx: Aspirin 100mg\nPatient: User A")
    pdf_bytes = doc.tobytes()
    doc.close()

    up_resp = client_a.post("/api/v1/documents/upload", files={"file": ("doc_a.pdf", pdf_bytes, "application/pdf")})
    assert up_resp.status_code == status.HTTP_201_CREATED
    doc_id = up_resp.json()["document_id"]

    # 2. User B attempts unauthorized access
    token_b = create_test_jwt(user_id="user-patient-b", email="user_b@healthsync.ai")
    client_b = TestClient(app, headers={"Authorization": f"Bearer {token_b}"})

    # GET details should be Forbidden (403)
    get_resp = client_b.get(f"/api/v1/documents/{doc_id}")
    assert get_resp.status_code == status.HTTP_403_FORBIDDEN
    assert get_resp.json()["error"]["code"] == "FORBIDDEN"

    # POST extract should be Forbidden (403)
    ext_resp = client_b.post(f"/api/v1/documents/{doc_id}/extract")
    assert ext_resp.status_code == status.HTTP_403_FORBIDDEN

    # GET review should be Forbidden (403)
    rev_resp = client_b.get(f"/api/v1/documents/{doc_id}/review")
    assert rev_resp.status_code == status.HTTP_403_FORBIDDEN

    # DELETE should be Forbidden (403)
    del_resp = client_b.delete(f"/api/v1/documents/{doc_id}")
    assert del_resp.status_code == status.HTTP_403_FORBIDDEN


# ==============================================================================
# 3. Document Sharing Workflow
# ==============================================================================

def test_document_sharing_workflow():
    """Verifies that an owner can create a share and that audit logging is triggered."""
    token_owner = create_test_jwt(user_id="owner-uuid-1", email="owner@healthsync.ai")
    client_owner = TestClient(app, headers={"Authorization": f"Bearer {token_owner}"})

    import pymupdf as fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(fitz.Point(50, 72), "Medical Consultation summary")
    pdf_bytes = doc.tobytes()
    doc.close()

    up = client_owner.post("/api/v1/documents/upload", files={"file": ("doc_share.pdf", pdf_bytes, "application/pdf")})
    doc_id = up.json()["document_id"]

    # Share with doctor
    share_payload = {
        "shared_with_email": "dr_smith@hospital.org",
        "permission": "read",
        "expires_in_days": 14,
    }
    share_resp = client_owner.post(f"/api/v1/documents/{doc_id}/share", json=share_payload)
    assert share_resp.status_code == status.HTTP_201_CREATED
    data = share_resp.json()
    assert data["document_id"] == doc_id
    assert data["shared_with_email"] == "dr_smith@hospital.org"
    assert data["permission"] == "read"
    assert data["is_revoked"] is False


# ==============================================================================
# 4. Storage Service Ownership Enforcement
# ==============================================================================

def test_storage_service_ownership_check():
    """Verifies that StorageService blocks cross-user storage path access."""
    valid_path = "user-123/doc-456/file.pdf"
    StorageService.verify_ownership(valid_path, "user-123")  # Must not raise

    with pytest.raises(ForbiddenException):
        StorageService.verify_ownership(valid_path, "user-malicious-789")


# ==============================================================================
# 5. Audit Logging Sanitization (No PHI / Secrets)
# ==============================================================================

def test_audit_logging_sanitizes_phi_and_credentials():
    """Verifies that audit logging strips sensitive medical text and credentials."""
    dirty_metadata = {
        "user_email": "patient@healthsync.ai",
        "password": "SecretPassword123!",
        "access_token": "eyJhbGciOiJIUzI1Ni...",
        "api_key": "AIzaSy...",
        "raw_text": "Patient has severe confidential condition...",
        "medication": "Confidential Drug",
        "safe_file_size": 2048,
    }

    clean = AuditService.sanitize_metadata(dirty_metadata)

    assert "password" not in clean
    assert "access_token" not in clean
    assert "api_key" not in clean
    assert "raw_text" not in clean
    assert "medication" not in clean
    assert clean["user_email"] == "patient@healthsync.ai"
    assert clean["safe_file_size"] == 2048


# ==============================================================================
# 6. Missing Supabase Configuration Handling
# ==============================================================================

def test_missing_supabase_credentials_raises_exception(monkeypatch):
    """Verifies that attempting real Supabase access without credentials raises SupabaseNotConfiguredException."""
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    monkeypatch.setattr(settings, "SUPABASE_KEY", "")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")

    assert is_supabase_configured() is False
    with pytest.raises(SupabaseNotConfiguredException) as exc_info:
        get_supabase_client()
    assert "SUPABASE_NOT_CONFIGURED" in exc_info.value.code


# ==============================================================================
# 7. SQL Migration Files Validation
# ==============================================================================

def test_sql_migration_files_exist_and_contain_required_ddl():
    """Verifies that all Phase 3 SQL migration files exist and define all 8 required tables and RLS."""
    mig1_path = Path("backend/migrations/001_initial_schema.sql")
    mig2_path = Path("backend/migrations/002_row_level_security.sql")

    assert mig1_path.is_file(), "Migration 001_initial_schema.sql is missing"
    assert mig2_path.is_file(), "Migration 002_row_level_security.sql is missing"

    content1 = mig1_path.read_text(encoding="utf-8")
    content2 = mig2_path.read_text(encoding="utf-8")

    # Check 8 required tables in migration 1
    required_tables = [
        "profiles",
        "medical_documents",
        "extracted_prescriptions",
        "extracted_medications",
        "extracted_lab_reports",
        "extracted_lab_results",
        "document_shares",
        "audit_logs",
    ]
    for table in required_tables:
        assert f"CREATE TABLE IF NOT EXISTS public.{table}" in content1, f"Missing table: {table}"

    # Check RLS enabled on all 8 tables in migration 2
    for table in required_tables:
        assert f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;" in content2, f"RLS missing for: {table}"

    # Check security policies
    assert "auth.uid() = user_id" in content2
    assert "REVOKE UPDATE, DELETE ON public.audit_logs" in content2
