import io
from unittest.mock import patch
import pymupdf as fitz
from PIL import Image
import pytest
from fastapi import status
from backend.app.core.config import settings
from backend.app.core.exceptions import (
    ValidationException,
    TesseractNotInstalledException,
)
from backend.app.schemas.document import DocumentType, PrescriptionData
from backend.app.services.ocr_service import OCRService
from backend.app.services.llm.base import BaseVisionLLMProvider


def create_synthetic_pdf(text: str) -> bytes:
    """Generates an in-memory synthetic PDF document with embedded text."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 72), text, fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_synthetic_image(fmt: str = "PNG") -> bytes:
    """Generates an in-memory synthetic image."""
    img = Image.new("RGB", (300, 100), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


# ==============================================================================
# 1. Successful PDF Upload
# ==============================================================================

def test_successful_pdf_upload(client):
    pdf_bytes = create_synthetic_pdf("Sample medical document")
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("medical_record.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "document_id" in data
    assert data["original_filename"] == "medical_record.pdf"
    assert data["mime_type"] == "application/pdf"
    assert data["file_size_bytes"] == len(pdf_bytes)
    assert data["status"] == "uploaded"
    assert "disclaimer" in data


# ==============================================================================
# 2. Successful Image Upload
# ==============================================================================

def test_successful_image_upload(client):
    img_bytes = create_synthetic_image("PNG")
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("lab_scan.png", img_bytes, "image/png")},
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "document_id" in data
    assert data["original_filename"] == "lab_scan.png"
    assert data["mime_type"] == "image/png"
    assert data["status"] == "uploaded"


# ==============================================================================
# 3. Unsupported File Format Rejection
# ==============================================================================

def test_unsupported_file_extension_rejected(client):
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("malicious.exe", b"MZexecutable_binary_content", "application/octet-stream")},
    )
    assert response.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    data = response.json()
    assert data["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


# ==============================================================================
# 4. Invalid File Content Rejection (Signature mismatch)
# ==============================================================================

def test_invalid_file_signature_rejected(client):
    # Has .pdf extension but content is plain text / corrupted
    fake_pdf = b"This is not a real PDF file header."
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("corrupted.pdf", fake_pdf, "application/pdf")},
    )
    assert response.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    data = response.json()
    assert data["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


# ==============================================================================
# 5. Oversized File Rejection
# ==============================================================================

def test_oversized_file_rejected(client):
    # Exceed settings.MAX_UPLOAD_SIZE_MB
    oversized_bytes = b"%PDF-" + b"0" * (settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024 + 10)
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("huge_report.pdf", oversized_bytes, "application/pdf")},
    )
    assert response.status_code == 413
    data = response.json()
    assert data["error"]["code"] == "FILE_TOO_LARGE"


# ==============================================================================
# 6. Missing Document Handling (404)
# ==============================================================================

def test_missing_document_returns_404(client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.get(f"/api/v1/documents/{fake_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    data = response.json()
    assert data["error"]["code"] == "ENTITY_NOT_FOUND"


# ==============================================================================
# 7. Document Processing and OCR Extraction
# ==============================================================================

def test_document_extraction_pipeline(client):
    rx_content = (
        "City Health Hospital\n"
        "Dr. Robert Miller\n"
        "Date: 15/11/2026\n"
        "Patient: Alice Johnson\n"
        "Rx:\n"
        "1. Tab. Amoxicillin 500mg tid for 7 days\n"
        "2. Paracetamol 650mg sos\n"
        "Diagnosis: Acute Sinusitis\n"
    )
    pdf_bytes = create_synthetic_pdf(rx_content)

    # 1. Upload
    up_resp = client.post(
        "/api/v1/documents/upload",
        files={"file": ("rx_alice.pdf", pdf_bytes, "application/pdf")},
    )
    doc_id = up_resp.json()["document_id"]

    # 2. Extract
    ext_resp = client.post(f"/api/v1/documents/{doc_id}/extract")
    assert ext_resp.status_code == status.HTTP_200_OK
    detail = ext_resp.json()

    assert detail["status"] == "extracted"
    assert detail["document_type"] == "prescription"
    assert "Alice Johnson" in detail["raw_text"]
    assert detail["extraction_result"] is not None

    structured = detail["extraction_result"]["structured_data"]
    assert structured["patient_name"] == "Alice Johnson"
    assert structured["doctor_name"] == "Dr. Robert Miller"
    assert structured["diagnosis_text"] == "Acute Sinusitis"
    assert len(structured["medications"]) >= 1

    # 3. Check status endpoint
    stat_resp = client.get(f"/api/v1/documents/{doc_id}/status")
    assert stat_resp.status_code == status.HTTP_200_OK
    assert stat_resp.json()["status"] == "extracted"


# ==============================================================================
# 8. Invalid Structured Extraction Response Validation
# ==============================================================================

def test_invalid_structured_extraction_validation():
    """Tests that Pydantic validation rejects malformed LLM responses."""
    class DummyProvider(BaseVisionLLMProvider):
        async def _call_vision_model(self, prompt, images):
            return ""

    provider = DummyProvider(api_key="mock", model_name="dummy")

    # Invalid JSON string
    with pytest.raises(ValidationException):
        provider.extract_json_from_response("Not a valid json response")

    # Missing required field in target schema (e.g. missing medicine name)
    with pytest.raises(ValidationException):
        provider.validate_structured_output(
            {"patient_name": "Test", "medications": [{"dosage": "500mg"}]},  # 'name' is required
            DocumentType.PRESCRIPTION,
        )


# ==============================================================================
# 9. Missing OCR Dependency Handling
# ==============================================================================

def test_missing_tesseract_dependency_handling(client):
    """Verifies that missing Tesseract OCR returns 503 with Windows installation guide."""
    img_bytes = create_synthetic_image("PNG")
    up_resp = client.post(
        "/api/v1/documents/upload",
        files={"file": ("scan_needing_ocr.png", img_bytes, "image/png")},
    )
    doc_id = up_resp.json()["document_id"]

    # Mock Tesseract as unavailable
    with patch.object(OCRService, "is_tesseract_available", return_value=False):
        response = client.post(f"/api/v1/documents/{doc_id}/extract")
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        data = response.json()
        assert data["error"]["code"] == "OCR_DEPENDENCY_MISSING"
        assert "winget install UB-Mannheim.TesseractOCR" in data["error"]["message"]


# ==============================================================================
# 10. Missing LLM Configuration Handling
# ==============================================================================

def test_missing_llm_configuration_handling(client):
    """Verifies that forcing LLM extraction when unconfigured returns 501 NotImplemented."""
    pdf_bytes = create_synthetic_pdf("Sample consultation notes")
    up_resp = client.post(
        "/api/v1/documents/upload",
        files={"file": ("notes.pdf", pdf_bytes, "application/pdf")},
    )
    doc_id = up_resp.json()["document_id"]

    # Request extraction with force_llm=True while LLM is not configured
    response = client.post(f"/api/v1/documents/{doc_id}/extract?force_llm=true")
    assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
    data = response.json()
    assert data["error"]["code"] == "LLM_NOT_CONFIGURED"
    assert "LLM_PROVIDER" in data["error"]["message"]
