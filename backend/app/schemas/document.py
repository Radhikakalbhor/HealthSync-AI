from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field
from backend.app.core.config import settings


class DocumentType(str, Enum):
    """Types of medical records supported by HealthSync AI."""
    PRESCRIPTION = "prescription"
    BLOOD_TEST = "blood_test"
    LAB_REPORT = "lab_report"
    IMAGING_REPORT = "imaging_report"
    DISCHARGE_SUMMARY = "discharge_summary"
    CONSULTATION_RECORD = "consultation_record"
    NON_MEDICAL = "non_medical"
    OTHER = "other"


class DocumentStatus(str, Enum):
    """Processing lifecycle status for a medical document."""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    EXTRACTED = "extracted"
    NEEDS_REVIEW = "needs_review"
    UNSUPPORTED = "unsupported"
    FAILED = "failed"


# ==============================================================================
# Structured Medical Extraction Schemas
# ==============================================================================

class MedicationItem(BaseModel):
    """Structured details for a single prescribed medication."""
    name: str = Field(..., description="Medicine or active ingredient name")
    dosage: Optional[str] = Field(None, description="Strength / dosage (e.g., 500mg, 10ml)")
    frequency: Optional[str] = Field(None, description="Intake schedule (e.g., Once daily, BID, TID, PRN)")
    duration: Optional[str] = Field(None, description="Course length (e.g., 7 days, 1 month)")
    instructions: Optional[str] = Field(None, description="Patient guidance (e.g., After meals, with water)")


class PrescriptionData(BaseModel):
    """Structured medical data extracted from a prescription."""
    patient_name: Optional[str] = Field(None, description="Patient name if present on prescription")
    doctor_name: Optional[str] = Field(None, description="Prescribing physician name")
    clinic_or_hospital: Optional[str] = Field(None, description="Clinic, practice, or hospital name")
    prescription_date: Optional[str] = Field(None, description="Date prescription was written")
    medications: List[MedicationItem] = Field(default_factory=list, description="List of prescribed medicines")
    diagnosis_text: Optional[str] = Field(
        None,
        description="Explicit diagnosis written by doctor. NOTE: Not an AI diagnosis.",
    )


class LabTestItem(BaseModel):
    """Individual laboratory test measurement."""
    test_name: str = Field(..., description="Name of test/analyte (e.g., Hemoglobin, Fasting Blood Sugar)")
    measured_value: Optional[str] = Field(None, description="Observed patient test value")
    unit: Optional[str] = Field(None, description="Unit of measurement (e.g., g/dL, mg/dL)")
    reference_range: Optional[str] = Field(None, description="Standard biological reference interval")
    test_category: Optional[str] = Field(None, description="Panel/sub-discipline (e.g., CBC, Lipid Panel)")
    is_abnormal: Optional[bool] = Field(
        None,
        description="Flagged if value is marked High (H), Low (L), or outside reference interval in original report",
    )


class LabReportData(BaseModel):
    """Structured medical data extracted from a laboratory or blood test report."""
    patient_name: Optional[str] = Field(None, description="Patient name as stated on report")
    doctor_or_lab_name: Optional[str] = Field(None, description="Reporting laboratory or referring doctor")
    report_date: Optional[str] = Field(None, description="Date report was produced")
    test_category: Optional[str] = Field(None, description="Category of lab tests performed")
    tests: List[LabTestItem] = Field(default_factory=list, description="Array of lab test observations")


class ImagingReportData(BaseModel):
    """Structured medical data extracted from an imaging or radiology report."""
    patient_name: Optional[str] = Field(None, description="Patient name")
    radiologist_name: Optional[str] = Field(None, description="Reporting radiologist name")
    imaging_center_or_hospital: Optional[str] = Field(None, description="Facility where scan was performed")
    report_date: Optional[str] = Field(None, description="Date scan/report was executed")
    modality: Optional[str] = Field(None, description="Imaging modality (e.g., X-Ray, MRI, CT Scan, Ultrasound)")
    body_part_or_region: Optional[str] = Field(None, description="Anatomical region (e.g., Chest, Lumbar Spine, Brain)")
    clinical_indication: Optional[str] = Field(None, description="Clinical reason stated on order")
    findings: Optional[str] = Field(None, description="Recorded radiological observations")
    impression: Optional[str] = Field(None, description="Radiologist's documented impression")


class ConsultationData(BaseModel):
    """Structured medical data extracted from a clinical consultation note."""
    patient_name: Optional[str] = Field(None, description="Patient name")
    doctor_name: Optional[str] = Field(None, description="Consulting physician name")
    clinic_or_hospital: Optional[str] = Field(None, description="Consulting clinic or hospital")
    consultation_date: Optional[str] = Field(None, description="Date of clinical consultation")
    chief_complaint: Optional[str] = Field(None, description="Reason for visit stated by patient")
    history_of_present_illness: Optional[str] = Field(None, description="HPI notes documented by physician")
    examination_findings: Optional[str] = Field(None, description="Physical examination notes")
    assessment_and_plan: Optional[str] = Field(None, description="Doctor recorded assessment and clinical plan")
    follow_up_instructions: Optional[str] = Field(None, description="Documented follow-up recommendations")


class DischargeSummaryData(BaseModel):
    """Structured medical data extracted from a hospital discharge summary."""
    patient_name: Optional[str] = Field(None, description="Patient name")
    hospital_name: Optional[str] = Field(None, description="Discharging hospital name")
    admission_date: Optional[str] = Field(None, description="Date admitted to hospital")
    discharge_date: Optional[str] = Field(None, description="Date discharged from hospital")
    admission_diagnosis: Optional[str] = Field(None, description="Reason / diagnosis upon hospital admission")
    discharge_diagnosis: Optional[str] = Field(None, description="Final confirmed diagnosis at discharge")
    hospital_course: Optional[str] = Field(None, description="Summary of inpatient stay and treatments")
    discharge_medications: List[MedicationItem] = Field(default_factory=list, description="Medications prescribed at discharge")
    discharge_advice: Optional[str] = Field(None, description="Post-discharge care guidance and precautions")


class GenericDocumentData(BaseModel):
    """Fallback structured container for unclassified documents."""
    summary: Optional[str] = Field(None, description="Brief summary of document text")
    extracted_metadata: Dict[str, Any] = Field(default_factory=dict)


# Union type for structured extraction
StructuredMedicalData = Union[
    PrescriptionData,
    LabReportData,
    ImagingReportData,
    ConsultationData,
    DischargeSummaryData,
    GenericDocumentData,
]


# ==============================================================================
# Confidence & Review Schemas
# ==============================================================================

class ConfidenceInformation(BaseModel):
    """Empirical confidence details distinguishing OCR from AI interpretation."""
    ocr_confidence: Optional[float] = Field(
        None,
        description="Measured OCR word-level mean confidence (0.0 to 1.0) from Tesseract, or 1.0 for digital PDF text",
    )
    llm_confidence: Optional[float] = Field(
        None,
        description="Model self-reported or heuristic confidence if available",
    )
    overall_confidence: Optional[float] = Field(
        None,
        description="Calibrated overall extraction confidence score",
    )
    confidence_method: str = Field(
        ...,
        description="Documented methodology (e.g. 'tesseract_word_mean', 'digital_pdf_stream', 'unavailable')",
    )
    is_calibrated: bool = Field(
        default=True,
        description="True if score is empirically measured; False if confidence could not be calibrated",
    )


class ExtractionResult(BaseModel):
    """Comprehensive container for extraction results."""
    document_id: str
    document_type: DocumentType = DocumentType.OTHER
    raw_text: str = Field(..., description="Preserved verbatim extracted text from OCR/parser")
    page_count: int = Field(default=1, description="Number of document pages processed")
    ocr_engine: str = Field(..., description="Engine used (e.g. 'pymupdf_native_text', 'tesseract_ocr')")
    confidence: Optional[float] = Field(
        None,
        description="Measured confidence score (0.0 to 1.0) if provided by OCR engine; null if unavailable",
    )
    confidence_method: Optional[str] = Field(
        None,
        description="Documented methodology for confidence score (e.g. 'tesseract_word_mean', 'unavailable')",
    )
    confidence_info: Optional[ConfidenceInformation] = Field(
        None,
        description="Structured confidence breakdown distinguishing OCR from AI",
    )
    structured_data: Optional[StructuredMedicalData] = Field(
        None,
        description="Validated structured medical fields extracted from document",
    )
    llm_extracted: bool = Field(
        False,
        description="Indicates whether structured data was generated by a Vision LLM",
    )
    fields_requiring_verification: List[str] = Field(
        default_factory=list,
        description="List of fields where OCR confidence was low, format was ambiguous, or patient info is uncertain",
    )
    requires_verification: bool = Field(
        False,
        description="Flag indicating patient/provider should review the document on the review screen",
    )
    extraction_notes: Optional[str] = None
    review_notes: Optional[str] = None
    disclaimer: str = Field(
        default=settings.MEDICAL_DISCLAIMER,
        description="Mandatory medical non-diagnostic disclaimer",
    )


class DocumentUploadResponse(BaseModel):
    """Response returned upon successful file ingestion."""
    document_id: str = Field(..., description="Unique UUID assigned to the document")
    original_filename: str = Field(..., description="Original upload filename")
    document_type: DocumentType = Field(DocumentType.OTHER, description="Initial classified document category")
    file_size_bytes: int = Field(..., description="Uploaded file size in bytes")
    mime_type: str = Field(..., description="Validated MIME type")
    status: DocumentStatus = Field(DocumentStatus.UPLOADED, description="Current processing state")
    created_at: datetime = Field(..., description="UTC upload timestamp")
    disclaimer: str = Field(
        default=settings.MEDICAL_DISCLAIMER,
        description="Medical safety disclaimer",
    )


class DocumentDetailResponse(BaseModel):
    """Complete document record including metadata, OCR text, and structured extraction."""
    document_id: str
    id: Optional[str] = None
    original_filename: str
    filename: Optional[str] = None
    document_type: DocumentType
    file_size_bytes: int
    mime_type: str
    status: DocumentStatus
    processing_status: Optional[str] = None
    ocr_confidence: Optional[float] = None
    needs_human_review: Optional[bool] = None
    confidence_score: Optional[float] = None
    raw_text: Optional[str] = None
    extraction_result: Optional[ExtractionResult] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    disclaimer: str = Field(
        default=settings.MEDICAL_DISCLAIMER,
        description="Medical safety disclaimer",
    )


class DocumentReviewResponse(BaseModel):
    """Specialized response tailored for the future Medical Document Review screen."""
    document_id: str
    document_category: DocumentType
    processing_status: DocumentStatus
    extracted_information: Optional[StructuredMedicalData] = None
    extraction_engine_used: str
    ocr_text: str
    confidence_information: ConfidenceInformation
    fields_requiring_verification: List[str] = Field(default_factory=list)
    requires_verification: bool = False
    review_notes: Optional[str] = None
    medical_disclaimer: str = Field(
        default=settings.MEDICAL_DISCLAIMER,
        description="Medical safety disclaimer",
    )


class DocumentStatusResponse(BaseModel):
    """Lightweight response for polling processing status."""
    document_id: str
    status: DocumentStatus
    document_type: DocumentType
    error_message: Optional[str] = None
    updated_at: datetime
