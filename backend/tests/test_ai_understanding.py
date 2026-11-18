import io
from pathlib import Path
from unittest.mock import AsyncMock, patch
from PIL import Image, ImageDraw
import pytest
from fastapi import status
import httpx

from backend.app.core.config import settings
from backend.app.core.exceptions import (
    ValidationException,
    LLMNotConfiguredException,
    DocumentProcessingException,
)
from backend.app.schemas.document import (
    DocumentType,
    PrescriptionData,
    LabReportData,
    ImagingReportData,
    DischargeSummaryData,
    ConsultationData,
)
from backend.app.services.ocr_service import OCRService
from backend.app.services.extractor_service import ExtractorService
from backend.app.services.llm.gemini_provider import GeminiVisionProvider
from backend.app.services.llm.factory import get_vision_provider


def create_ocr_test_image(text: str) -> bytes:
    """Creates a high-contrast synthetic image containing crisp text for OCR."""
    img = Image.new("RGB", (600, 150), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ==============================================================================
# 1. Tesseract Executable Configuration
# ==============================================================================

def test_tesseract_executable_configuration():
    """Verifies that TESSERACT_CMD is configured and points to a valid file."""
    assert settings.TESSERACT_CMD is not None
    tess_path = Path(settings.TESSERACT_CMD)
    assert tess_path.is_file(), f"Tesseract executable not found at: {settings.TESSERACT_CMD}"
    assert OCRService.is_tesseract_available() is True


# ==============================================================================
# 2. Actual OCR Invocation Using Synthetic Document
# ==============================================================================

def test_actual_ocr_invocation():
    """Executes actual local Tesseract OCR on a synthetic image."""
    img_bytes = create_ocr_test_image("Patient: John Doe\nRx: Amoxicillin 500mg")
    img = Image.open(io.BytesIO(img_bytes))

    extracted_text, confidence, method = OCRService.extract_text_from_image(img)

    assert len(extracted_text) > 0
    assert "John" in extracted_text or "Amoxicillin" in extracted_text or "Patient" in extracted_text
    assert confidence is not None
    assert 0.0 <= confidence <= 1.0
    assert method == "tesseract_word_mean"


# ==============================================================================
# 3. Handwritten / Image Fallback & Verification Detection
# ==============================================================================

def test_image_extraction_with_verification_flags(client):
    """Verifies that an uploaded image passes through real OCR and flags fields for review."""
    img_bytes = create_ocr_test_image("Prescription Record\nTab. Paracetamol 650mg once daily\nDiagnosis: Viral Fever")

    # Upload
    up_resp = client.post(
        "/api/v1/documents/upload",
        files={"file": ("handwritten_rx.png", img_bytes, "image/png")},
    )
    assert up_resp.status_code == status.HTTP_201_CREATED
    doc_id = up_resp.json()["document_id"]

    # Extract
    ext_resp = client.post(f"/api/v1/documents/{doc_id}/extract")
    assert ext_resp.status_code == status.HTTP_200_OK
    detail = ext_resp.json()

    assert detail["status"] in ["extracted", "needs_review"]
    assert detail["extraction_result"]["ocr_engine"] == "tesseract_ocr"

    # Patient name was not in the image, so it must be flagged for review
    assert "patient_name" in detail["extraction_result"]["fields_requiring_verification"]
    assert detail["extraction_result"]["requires_verification"] is True


# ==============================================================================
# 4. Gemini Provider Configuration & Factory
# ==============================================================================

def test_gemini_provider_configuration_factory():
    """Verifies GeminiVisionProvider is properly instantiated when configured."""
    with patch.object(settings, "LLM_PROVIDER", "gemini"), \
         patch.object(settings, "LLM_API_KEY", "dummy_gemini_api_key"), \
         patch.object(settings, "LLM_MODEL", "gemini-1.5-flash"):
        provider = get_vision_provider()
        assert isinstance(provider, GeminiVisionProvider)
        assert provider.api_key == "dummy_gemini_api_key"
        assert provider.model_name == "gemini-1.5-flash"


def test_missing_api_credentials_raises_exception():
    """Verifies LLMNotConfiguredException when credentials are missing."""
    with patch.object(settings, "LLM_PROVIDER", ""), \
         patch.object(settings, "LLM_API_KEY", ""):
        with pytest.raises(LLMNotConfiguredException):
            get_vision_provider()


def test_unsupported_provider_raises_validation_exception():
    """Verifies error for unsupported provider name."""
    with patch.object(settings, "LLM_PROVIDER", "unsupported_ai_vendor"), \
         patch.object(settings, "LLM_API_KEY", "some_key"):
        with pytest.raises(ValidationException):
            get_vision_provider()


# ==============================================================================
# 5. Gemini Mocked Multimodal Extraction & Pydantic Validation
# ==============================================================================

@pytest.mark.anyio
async def test_gemini_mocked_structured_extraction():
    """Tests multimodal vision extraction and Pydantic validation using mocked Gemini API response."""
    mock_response = """
    ```json
    {
      "patient_name": "Eleanor Vance",
      "doctor_name": "Dr. Henry Jekyll",
      "clinic_or_hospital": "St. Jude Hospital",
      "prescription_date": "2026-11-16",
      "medications": [
        {
          "name": "Metformin Hydrochloride",
          "dosage": "500mg",
          "frequency": "Twice daily",
          "duration": "30 days",
          "instructions": "Take after meals"
        }
      ],
      "diagnosis_text": "Type 2 Diabetes"
    }
    ```
    """
    provider = GeminiVisionProvider(api_key="test_key", model_name="gemini-1.5-flash")

    with patch.object(provider, "_call_vision_model", AsyncMock(return_value=mock_response)):
        dummy_img = Image.new("RGB", (100, 100))
        result = await provider.extract_structured_document(
            document_text="Raw OCR text",
            images=[dummy_img],
            doc_type=DocumentType.PRESCRIPTION,
        )

        assert isinstance(result, PrescriptionData)
        assert result.patient_name == "Eleanor Vance"
        assert result.doctor_name == "Dr. Henry Jekyll"
        assert len(result.medications) == 1
        assert result.medications[0].name == "Metformin Hydrochloride"
        assert result.medications[0].dosage == "500mg"


# ==============================================================================
# 6. Rate Limit Handling and Retry
# ==============================================================================

@pytest.mark.anyio
async def test_gemini_rate_limit_handling():
    """Tests that HTTP 429 rate limit is properly caught and retried."""
    provider = GeminiVisionProvider(api_key="test_key", model_name="gemini-1.5-flash")
    provider.max_retries = 2

    # Simulate 429 on all attempts
    with patch.object(
        provider,
        "_call_vision_model",
        AsyncMock(side_effect=DocumentProcessingException("Gemini API rate limit exceeded")),
    ), patch("time.sleep", return_value=None):
        dummy_img = Image.new("RGB", (50, 50))
        with pytest.raises(DocumentProcessingException) as exc_info:
            await provider.extract_structured_document("OCR text", [dummy_img], DocumentType.PRESCRIPTION)
        assert "after 2 attempts" in str(exc_info.value)


# ==============================================================================
# 7. Invalid AI Responses Handled Cleanly
# ==============================================================================

@pytest.mark.anyio
async def test_gemini_invalid_json_handling():
    """Tests that unparseable or schema-violating LLM responses raise ValidationException."""
    provider = GeminiVisionProvider(api_key="test_key", model_name="gemini-1.5-flash")

    # 1. Non-JSON string
    with pytest.raises(ValidationException):
        provider.extract_json_from_response("I am an AI and here is your prescription...")

    # 2. Schema violation: medications missing required 'name' field
    with pytest.raises(ValidationException):
        provider.validate_structured_output(
            {"patient_name": "Test", "medications": [{"dosage": "10mg"}]},
            DocumentType.PRESCRIPTION,
        )


# ==============================================================================
# 8. Structured Medical Extraction & Null Handling
# ==============================================================================

def test_structured_extraction_null_handling():
    """Verifies that missing or uncertain medical fields remain strictly None."""
    partial_text = "Clinic Visit\nRx:\nTab. Ibuprofen 400mg"
    result = ExtractorService.extract_structured_data(partial_text, DocumentType.PRESCRIPTION)

    assert isinstance(result, PrescriptionData)
    # Uncertain or unstated fields MUST be null
    assert result.patient_name is None
    assert result.doctor_name is None
    assert result.prescription_date is None
    assert result.diagnosis_text is None
    assert len(result.medications) == 1
    assert result.medications[0].name == "Ibuprofen"
    assert result.medications[0].dosage == "400mg"
    assert result.medications[0].duration is None
    assert result.medications[0].instructions is None


def test_imaging_report_extraction():
    """Verifies structured extraction for imaging/radiology documents."""
    text = (
        "Metro Radiology Clinic\n"
        "Dr. David Banner\n"
        "Date: 10/11/2026\n"
        "Patient: Bruce Wayne\n"
        "MRI Examination of the Lumbar Spine\n"
        "Findings:\n"
        "Normal vertebral body height and alignment. L4-L5 mild disc bulge without canal stenosis.\n"
        "Impression:\n"
        "Mild degenerative disc disease at L4-L5 without nerve root impingement.\n"
    )
    result = ExtractorService.extract_structured_data(text, DocumentType.IMAGING_REPORT)

    assert isinstance(result, ImagingReportData)
    assert result.patient_name == "Bruce Wayne"
    assert result.radiologist_name == "Dr. David Banner"
    assert result.modality == "MRI"
    assert "disc bulge" in result.findings
    assert "Mild degenerative" in result.impression


# ==============================================================================
# 9. Medical Document Review Endpoint
# ==============================================================================

def test_document_review_endpoint(client):
    """Verifies the GET /api/v1/documents/{document_id}/review endpoint structure."""
    text = (
        "Metropolis General Hospital\n"
        "Dr. Marcus Vance\n"
        "Date: 16/11/2026\n"
        "Patient: Clark Kent\n"
        "Rx:\n"
        "Tab. Metformin 500mg once daily\n"
        "Diagnosis: Impaired Fasting Glucose\n"
    )
    import pymupdf as fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(fitz.Point(50, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()

    # Upload & extract
    up_resp = client.post("/api/v1/documents/upload", files={"file": ("rx_clark.pdf", pdf_bytes, "application/pdf")})
    doc_id = up_resp.json()["document_id"]
    client.post(f"/api/v1/documents/{doc_id}/extract")

    # Review endpoint
    rev_resp = client.get(f"/api/v1/documents/{doc_id}/review")
    assert rev_resp.status_code == status.HTTP_200_OK
    rev_data = rev_resp.json()

    assert rev_data["document_id"] == doc_id
    assert rev_data["document_category"] == "prescription"
    assert rev_data["processing_status"] == "extracted"
    assert rev_data["ocr_text"] != ""
    assert "confidence_information" in rev_data
    assert rev_data["confidence_information"]["is_calibrated"] is True
    assert "fields_requiring_verification" in rev_data
    assert "medical_disclaimer" in rev_data
    assert "NEVER" in rev_data["medical_disclaimer"]
