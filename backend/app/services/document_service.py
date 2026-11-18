import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from PIL import Image

from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.core.exceptions import (
    HealthSyncException,
    EntityNotFoundException,
    ForbiddenException,
    DocumentProcessingException,
    TesseractNotInstalledException,
)
from backend.app.core.supabase_client import is_supabase_configured
from backend.app.schemas.document import (
    DocumentType,
    DocumentStatus,
    ConfidenceInformation,
    ExtractionResult,
    DocumentUploadResponse,
    DocumentDetailResponse,
    DocumentReviewResponse,
    DocumentStatusResponse,
    PrescriptionData,
    LabReportData,
)
from backend.app.schemas.auth import ShareDocumentRequest, DocumentShareResponse
from backend.app.utils.file_security import (
    sanitize_filename,
    detect_and_validate_mime,
    validate_file_size,
    generate_secure_storage_path,
    ensure_upload_dir,
)
from backend.app.services.ocr_service import OCRService
from backend.app.services.pdf_service import PDFService
from backend.app.services.classifier_service import ClassifierService
from backend.app.services.extractor_service import ExtractorService
from backend.app.services.llm.factory import get_vision_provider
from backend.app.services.llm.base import BaseVisionLLMProvider
from backend.app.services.audit_service import AuditService, AuditAction
from backend.app.services.storage_service import StorageService
from backend.app.services.db_service import DatabaseService


class DocumentService:
    """
    Central orchestration service for document ingestion, storage,
    OCR, classification, and structured medical extraction.
    Enforces strict user ownership and compliance audit logging.
    """

    _lock = threading.Lock()
    _metadata_file = ensure_upload_dir() / "metadata.json"

    @classmethod
    def _load_all_records(cls) -> Dict[str, Dict[str, Any]]:
        """Loads persistent document records from disk."""
        if not cls._metadata_file.exists():
            return {}
        try:
            with open(cls._metadata_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    @classmethod
    def _save_record(cls, doc_id: str, record_data: Dict[str, Any]) -> None:
        """Persists or updates a document record in local storage."""
        with cls._lock:
            all_records = cls._load_all_records()
            all_records[doc_id] = record_data
            with open(cls._metadata_file, "w", encoding="utf-8") as f:
                json.dump(all_records, f, indent=2, default=str)

    @classmethod
    def _is_demo_user(cls, user_id: str) -> bool:
        """Determines if the user identity belongs to an isolated demo/sandbox account."""
        if not user_id:
            return False
        return user_id == "demo-patient-001" or str(user_id).startswith("demo-")

    @classmethod
    def _should_use_supabase(cls, user_id: str) -> bool:
        """Only use Supabase for non-demo users when Supabase is configured."""
        if cls._is_demo_user(user_id):
            return False
        return is_supabase_configured()

    @classmethod
    def _ensure_demo_records_seeded(cls, user_id: str) -> None:
        """Seeds two synthetic medical records for demo users if not already present."""
        if not cls._is_demo_user(user_id):
            return

        demo_rx_id = "demo-doc-amoxicillin-rx"
        demo_lab_id = "demo-doc-metabolic-panel"

        upload_dir = ensure_upload_dir()
        all_records = cls._load_all_records()
        records_changed = False

        now = datetime.now(timezone.utc).isoformat()

        # 1. Synthetic Prescription: Amoxicillin
        if demo_rx_id not in all_records:
            rx_filename = "Synthetic_Prescription_Amoxicillin.pdf"
            rx_path = upload_dir / rx_filename
            if not rx_path.exists():
                try:
                    import pymupdf
                    d = pymupdf.open()
                    p = d.new_page(width=595, height=842)
                    p.insert_text(
                        (50, 60),
                        "METRO HEALTH FAMILY MEDICINE - SYNTHETIC DEMO RECORD\n"
                        "Doctor: Dr. Sarah Lin, MD (SYNTHETIC CLINICIAN)\n"
                        "Patient: Alex Morgan (SYNTHETIC PATIENT)\n"
                        "Date: 2026-11-10\n"
                        "Diagnosis: Acute Bacterial Sinusitis (Synthetic)\n\n"
                        "PRESCRIPTION:\n"
                        "1. Amoxicillin 500 mg Capsule\n"
                        "   Sig: Take 1 capsule orally every 8 hours with food for 10 days.\n"
                        "   Dispense: 30 capsules | Refills: 0\n",
                        fontsize=11,
                    )
                    d.save(str(rx_path))
                    d.close()
                except Exception as e:
                    logger.warning("Could not generate synthetic Rx PDF: %s", str(e))

            all_records[demo_rx_id] = {
                "document_id": demo_rx_id,
                "user_id": user_id,
                "original_filename": "Synthetic_Prescription_Amoxicillin.pdf",
                "stored_filename": "Synthetic_Prescription_Amoxicillin.pdf",
                "storage_path": "Synthetic_Prescription_Amoxicillin.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": 14200,
                "status": DocumentStatus.EXTRACTED.value,
                "document_type": DocumentType.PRESCRIPTION.value,
                "raw_text": (
                    "METRO HEALTH FAMILY MEDICINE - SYNTHETIC DEMO RECORD\n"
                    "Doctor: Dr. Sarah Lin, MD\n"
                    "Patient: Alex Morgan (SYNTHETIC PATIENT)\n"
                    "Date: 2026-11-10\n"
                    "Diagnosis: Acute Bacterial Sinusitis\n"
                    "Rx: Amoxicillin 500 mg Capsule\n"
                    "Sig: Take 1 capsule orally every 8 hours with food for 10 days."
                ),
                "extraction_result": {
                    "document_id": demo_rx_id,
                    "document_type": DocumentType.PRESCRIPTION.value,
                    "raw_text": (
                        "METRO HEALTH FAMILY MEDICINE - SYNTHETIC DEMO RECORD\n"
                        "Doctor: Dr. Sarah Lin, MD\n"
                        "Patient: Alex Morgan (SYNTHETIC PATIENT)\n"
                        "Date: 2026-11-10\n"
                        "Diagnosis: Acute Bacterial Sinusitis\n"
                        "Rx: Amoxicillin 500 mg Capsule\n"
                        "Sig: Take 1 capsule orally every 8 hours with food for 10 days."
                    ),
                    "page_count": 1,
                    "ocr_engine": "pymupdf_native_text",
                    "confidence": 0.98,
                    "confidence_method": "digital_pdf_stream",
                    "confidence_info": {
                        "ocr_confidence": 0.98,
                        "llm_confidence": None,
                        "overall_confidence": 0.98,
                        "confidence_method": "digital_pdf_stream (Calibrated Rule-Based Extraction)",
                        "is_calibrated": True,
                    },
                    "structured_data": {
                        "patient_name": "Alex Morgan",
                        "doctor_name": "Dr. Sarah Lin, MD",
                        "clinic_or_hospital": "Metro Health Family Medicine",
                        "prescription_date": "2026-11-10",
                        "diagnosis_text": "Acute Bacterial Sinusitis (Synthetic Demo)",
                        "medications": [
                            {
                                "name": "Amoxicillin Capsule",
                                "dosage": "500 mg",
                                "frequency": "every 8 hours",
                                "duration": "10 days",
                                "instructions": "orally with food",
                            }
                        ],
                    },
                    "llm_extracted": False,
                    "fields_requiring_verification": [],
                    "requires_verification": False,
                    "extraction_notes": "Rule-based extraction with calibrated confidence scoring (Synthetic Demo Record).",
                    "disclaimer": settings.MEDICAL_DISCLAIMER,
                },
                "needs_human_review": False,
                "requires_verification": False,
                "user_reviewed": True,
                "user_reviewed_at": now,
                "created_at": now,
                "updated_at": now,
            }
            records_changed = True

        # 2. Synthetic Lab Report: Comprehensive Metabolic Panel (CMP)
        if demo_lab_id not in all_records:
            lab_filename = "Synthetic_Lab_Report_CMP.pdf"
            lab_path = upload_dir / lab_filename
            if not lab_path.exists():
                try:
                    import pymupdf
                    d = pymupdf.open()
                    p = d.new_page(width=595, height=842)
                    p.insert_text(
                        (50, 60),
                        "QUEST DIAGNOSTICS SYNTHETIC CLINICAL LABORATORY\n"
                        "Accreditation: CAP / CLIA #99D1029384 (SYNTHETIC DEMO DATA)\n"
                        "Ordering Physician: Dr. Sarah Lin, MD\n"
                        "Patient: Alex Morgan (SYNTHETIC PATIENT) | DOB: 1988-04-12\n"
                        "Report Date: 2026-11-12\n\n"
                        "COMPREHENSIVE METABOLIC PANEL:\n"
                        "Fasting Blood Glucose: 92 mg/dL (Reference: 70-99) NORMAL\n"
                        "Serum Calcium: 9.4 mg/dL (Reference: 8.5-10.2) NORMAL\n"
                        "Serum Sodium: 140 mEq/L (Reference: 135-145) NORMAL\n"
                        "Serum Potassium: 4.2 mEq/L (Reference: 3.5-5.0) NORMAL\n"
                        "ALT: 24 U/L (Reference: 7-56) NORMAL\n",
                        fontsize=11,
                    )
                    d.save(str(lab_path))
                    d.close()
                except Exception as e:
                    logger.warning("Could not generate synthetic Lab PDF: %s", str(e))

            all_records[demo_lab_id] = {
                "document_id": demo_lab_id,
                "user_id": user_id,
                "original_filename": "Synthetic_Lab_Report_CMP.pdf",
                "stored_filename": "Synthetic_Lab_Report_CMP.pdf",
                "storage_path": "Synthetic_Lab_Report_CMP.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": 18500,
                "status": DocumentStatus.EXTRACTED.value,
                "document_type": DocumentType.LAB_REPORT.value,
                "raw_text": (
                    "QUEST DIAGNOSTICS SYNTHETIC CLINICAL LABORATORY\n"
                    "Ordering Physician: Dr. Sarah Lin, MD\n"
                    "Patient: Alex Morgan (SYNTHETIC PATIENT)\n"
                    "Report Date: 2026-11-12\n"
                    "Comprehensive Metabolic Panel:\n"
                    "Glucose: 92 mg/dL | Calcium: 9.4 mg/dL | Sodium: 140 mEq/L | Potassium: 4.2 mEq/L | ALT: 24 U/L"
                ),
                "extraction_result": {
                    "document_id": demo_lab_id,
                    "document_type": DocumentType.LAB_REPORT.value,
                    "raw_text": (
                        "QUEST DIAGNOSTICS SYNTHETIC CLINICAL LABORATORY\n"
                        "Ordering Physician: Dr. Sarah Lin, MD\n"
                        "Patient: Alex Morgan (SYNTHETIC PATIENT)\n"
                        "Report Date: 2026-11-12\n"
                        "Comprehensive Metabolic Panel:\n"
                        "Glucose: 92 mg/dL | Calcium: 9.4 mg/dL | Sodium: 140 mEq/L | Potassium: 4.2 mEq/L | ALT: 24 U/L"
                    ),
                    "page_count": 1,
                    "ocr_engine": "pymupdf_native_text",
                    "confidence": 0.99,
                    "confidence_method": "digital_pdf_stream",
                    "confidence_info": {
                        "ocr_confidence": 0.99,
                        "llm_confidence": None,
                        "overall_confidence": 0.99,
                        "confidence_method": "digital_pdf_stream (Calibrated Rule-Based Extraction)",
                        "is_calibrated": True,
                    },
                    "structured_data": {
                        "patient_name": "Alex Morgan",
                        "doctor_or_lab_name": "Quest Diagnostics (Synthetic Lab)",
                        "report_date": "2026-11-12",
                        "test_category": "Comprehensive Metabolic Panel",
                        "tests": [
                            {
                                "test_name": "Fasting Blood Glucose",
                                "measured_value": "92",
                                "unit": "mg/dL",
                                "reference_range": "70 - 99",
                                "test_category": "Metabolic",
                                "is_abnormal": False,
                            },
                            {
                                "test_name": "Serum Calcium",
                                "measured_value": "9.4",
                                "unit": "mg/dL",
                                "reference_range": "8.5 - 10.2",
                                "test_category": "Electrolytes",
                                "is_abnormal": False,
                            },
                            {
                                "test_name": "Serum Sodium",
                                "measured_value": "140",
                                "unit": "mEq/L",
                                "reference_range": "135 - 145",
                                "test_category": "Electrolytes",
                                "is_abnormal": False,
                            },
                            {
                                "test_name": "Serum Potassium",
                                "measured_value": "4.2",
                                "unit": "mEq/L",
                                "reference_range": "3.5 - 5.0",
                                "test_category": "Electrolytes",
                                "is_abnormal": False,
                            },
                            {
                                "test_name": "Alanine Aminotransferase (ALT)",
                                "measured_value": "24",
                                "unit": "U/L",
                                "reference_range": "7 - 56",
                                "test_category": "Hepatic",
                                "is_abnormal": False,
                            },
                        ],
                    },
                    "llm_extracted": False,
                    "fields_requiring_verification": [],
                    "requires_verification": False,
                    "extraction_notes": "Rule-based extraction with calibrated confidence scoring (Synthetic Demo Record).",
                    "disclaimer": settings.MEDICAL_DISCLAIMER,
                },
                "needs_human_review": False,
                "requires_verification": False,
                "user_reviewed": True,
                "user_reviewed_at": now,
                "created_at": now,
                "updated_at": now,
            }
            records_changed = True

        if records_changed:
            with cls._lock:
                current_on_disk = cls._load_all_records()
                current_on_disk[demo_rx_id] = all_records[demo_rx_id]
                current_on_disk[demo_lab_id] = all_records[demo_lab_id]
                with open(cls._metadata_file, "w", encoding="utf-8") as f:
                    json.dump(current_on_disk, f, indent=2, default=str)

    @classmethod
    def get_document_record(cls, doc_id: str, user_id: str) -> Dict[str, Any]:
        """
        Retrieves document record by ID after enforcing user ownership or active share.
        Raises EntityNotFoundException if missing, ForbiddenException if owned by another user.
        """
        cls._ensure_demo_records_seeded(user_id)

        # If Supabase is configured and not in demo mode, use database
        if cls._should_use_supabase(user_id):
            return DatabaseService.get_document_record(doc_id, user_id)

        # Fallback local metadata store
        records = cls._load_all_records()
        if doc_id not in records:
            raise EntityNotFoundException("Document", doc_id)

        rec = records[doc_id]
        rec_user = rec.get("user_id")
        if rec_user and rec_user != user_id:
            # Check for local shares
            shares = rec.get("shares", [])
            is_shared = any(s.get("shared_with_user_id") == user_id and not s.get("is_revoked") for s in shares)
            if not is_shared:
                raise ForbiddenException("Access forbidden. You do not own this medical document.")

        if not rec.get("extraction_result"):
            rec["extraction_result"] = DatabaseService.hydrate_extraction_result(rec, user_id)

        return rec

    # ==========================================================================
    # Upload Ingestion
    # ==========================================================================

    @classmethod
    async def upload_document(
        cls, original_filename: str, file_bytes: bytes, user_id: str
    ) -> DocumentUploadResponse:
        """
        Validates, securely stores, and records an uploaded medical document.
        Associates the document with the authenticated user_id.
        """
        clean_name = sanitize_filename(original_filename)
        mime_type = detect_and_validate_mime(file_bytes, clean_name)
        file_size = validate_file_size(file_bytes)

        # Generate secure UUID filename
        doc_id, target_path = generate_secure_storage_path(clean_name)

        # Always write binary content locally
        with open(target_path, "wb") as f:
            f.write(file_bytes)

        now = datetime.now(timezone.utc)
        storage_path = str(target_path.name)

        # If Supabase is configured, store in Supabase Storage and PostgreSQL
        if cls._should_use_supabase(user_id):
            try:
                storage_path = await StorageService.upload_file(
                    user_id=user_id,
                    document_id=doc_id,
                    filename=clean_name,
                    file_bytes=file_bytes,
                    mime_type=mime_type,
                )
                DatabaseService.create_document_record(
                    doc_id=doc_id,
                    user_id=user_id,
                    filename=clean_name,
                    storage_path=storage_path,
                    mime_type=mime_type,
                    file_size_bytes=file_size,
                )
            except Exception as e:
                logger.warning("Supabase storage/database ingestion warning: %s", str(e))

        # Persistent record
        record: Dict[str, Any] = {
            "document_id": doc_id,
            "user_id": user_id,
            "original_filename": clean_name,
            "stored_filename": target_path.name,
            "storage_path": storage_path,
            "mime_type": mime_type,
            "file_size_bytes": file_size,
            "status": DocumentStatus.UPLOADED.value,
            "document_type": DocumentType.OTHER.value,
            "raw_text": None,
            "extraction_result": None,
            "error_message": None,
            "shares": [],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        cls._save_record(doc_id, record)

        # Audit logging
        AuditService.log_event(
            action=AuditAction.DOCUMENT_UPLOAD,
            resource_type="medical_document",
            resource_id=doc_id,
            user_id=user_id,
            metadata={"mime_type": mime_type, "file_size_bytes": file_size},
        )

        return DocumentUploadResponse(
            document_id=doc_id,
            original_filename=clean_name,
            document_type=DocumentType.OTHER,
            file_size_bytes=file_size,
            mime_type=mime_type,
            status=DocumentStatus.UPLOADED,
            created_at=now,
            disclaimer=settings.MEDICAL_DISCLAIMER,
        )

    # ==========================================================================
    # Processing & Extraction Pipeline
    # ==========================================================================

    @classmethod
    async def process_and_extract(
        cls, doc_id: str, user_id: str, force_llm: bool = False
    ) -> DocumentDetailResponse:
        """
        Executes the extraction pipeline for a stored document after verifying ownership.
        """
        record = cls.get_document_record(doc_id, user_id)
        target_path = ensure_upload_dir() / record.get("stored_filename", f"{doc_id}.pdf")

        if not target_path.exists():
            raise DocumentProcessingException("Underlying document file is missing from storage.")

        # Update status to PROCESSING
        record["status"] = DocumentStatus.PROCESSING.value
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        cls._save_record(doc_id, record)

        try:
            raw_text = ""
            page_count = 1
            ocr_engine = "unknown"
            confidence: Optional[float] = None
            conf_method: Optional[str] = None
            rendered_images = []

            mime_type = record["mime_type"]

            if mime_type == "application/pdf":
                (
                    raw_text,
                    page_count,
                    ocr_engine,
                    confidence,
                    conf_method,
                    rendered_images,
                ) = PDFService.extract_pdf_content(target_path)

            elif mime_type in ["image/png", "image/jpeg"]:
                img = Image.open(target_path)
                rendered_images.append(img)
                raw_text, confidence, conf_method = OCRService.extract_text_from_image(img)
                ocr_engine = "tesseract_ocr"
                page_count = 1

            # Classify document and assess medical relevance
            doc_type, class_conf, is_medical, class_explanation = ClassifierService.classify_document(raw_text)

            # Case A: Confidently identified as non-medical document (e.g. resume, invoice)
            if not is_medical and doc_type == DocumentType.NON_MEDICAL:
                now = datetime.now(timezone.utc)
                record["status"] = DocumentStatus.UNSUPPORTED.value
                record["document_type"] = DocumentType.NON_MEDICAL.value
                record["raw_text"] = raw_text
                record["ocr_engine"] = ocr_engine
                record["confidence"] = None
                record["requires_verification"] = False
                record["error_message"] = class_explanation
                record["updated_at"] = now.isoformat()

                conf_info = ConfidenceInformation(
                    ocr_confidence=None,
                    llm_confidence=None,
                    overall_confidence=None,
                    confidence_method="non_medical_classification",
                    is_calibrated=True,
                )

                extraction_result = ExtractionResult(
                    document_id=doc_id,
                    document_type=DocumentType.NON_MEDICAL,
                    raw_text=raw_text,
                    page_count=page_count,
                    ocr_engine=ocr_engine,
                    confidence=None,
                    confidence_method="non_medical_classification",
                    confidence_info=conf_info,
                    structured_data=None,
                    llm_extracted=False,
                    fields_requiring_verification=[],
                    requires_verification=False,
                    extraction_notes="Non-medical document detected. Entity extraction omitted to avoid data fabrication.",
                    review_notes=class_explanation,
                    disclaimer=settings.MEDICAL_DISCLAIMER,
                )

                record["extraction_result"] = extraction_result.model_dump(mode="json")
                cls._save_record(doc_id, record)

                if cls._should_use_supabase(user_id):
                    try:
                        DatabaseService.update_document_extraction(
                            doc_id=doc_id,
                            user_id=user_id,
                            status=DocumentStatus.UNSUPPORTED,
                            document_type=DocumentType.NON_MEDICAL,
                            raw_text=raw_text,
                            ocr_engine=ocr_engine,
                            confidence=0.0,
                            confidence_method="non_medical_classification",
                            requires_verification=False,
                            fields_requiring_verification=[],
                            error_message=class_explanation,
                        )
                    except Exception as e:
                        logger.warning("Supabase update error for non-medical document: %s", str(e))

                AuditService.log_event(
                    action=AuditAction.DOCUMENT_EXTRACT,
                    resource_type="medical_document",
                    resource_id=doc_id,
                    user_id=user_id,
                    metadata={"document_type": DocumentType.NON_MEDICAL.value, "status": DocumentStatus.UNSUPPORTED.value},
                )

                return cls._build_detail_response(record)

            # Case B: Empty text / OCR failure
            if not raw_text or not raw_text.strip():
                now = datetime.now(timezone.utc)
                record["status"] = DocumentStatus.FAILED.value
                record["raw_text"] = ""
                record["ocr_engine"] = ocr_engine
                record["confidence"] = 0.0
                record["requires_verification"] = True
                record["error_message"] = "No readable text detected in document. OCR processing produced empty content."
                record["updated_at"] = now.isoformat()
                cls._save_record(doc_id, record)
                return cls._build_detail_response(record)

            # Case C: Medical or uncertain document — run extraction
            structured_data = None
            llm_used = False
            notes = None

            provider: Optional[BaseVisionLLMProvider] = None
            try:
                provider = get_vision_provider()
            except Exception:
                provider = None

            if provider is not None:
                try:
                    structured_data = await provider.extract_structured_document(
                        document_text=raw_text,
                        images=rendered_images,
                        doc_type=doc_type,
                    )
                    llm_used = True
                    notes = f"Extracted via {settings.LLM_PROVIDER} vision model ({settings.LLM_MODEL})."
                except Exception as e:
                    logger.warning("LLM extraction failed: %s. Falling back to heuristic parser.", str(e))
                    notes = f"LLM failed ({str(e)}). Used deterministic text parser."
                    structured_data = ExtractorService.extract_structured_data(raw_text, doc_type)
            else:
                if force_llm:
                    from backend.app.core.exceptions import LLMNotConfiguredException
                    raise LLMNotConfiguredException(settings.LLM_PROVIDER)
                structured_data = ExtractorService.extract_structured_data(raw_text, doc_type)
                notes = "Extracted via rule-based parser. Vision LLM provider not configured."

            # Calibrate confidence information
            method_desc = conf_method or ("digital_pdf_stream" if ocr_engine == "pymupdf_native_text" else "tesseract_word_mean")
            is_calibrated = (confidence is not None or ocr_engine == "pymupdf_native_text")
            llm_conf = 0.95 if llm_used else None
            ocr_conf_effective = 1.0 if (confidence is None and ocr_engine == "pymupdf_native_text") else (confidence or 0.75)
            overall_conf = round(ocr_conf_effective * (0.95 if llm_used else 0.90), 3)

            confidence_info = ConfidenceInformation(
                ocr_confidence=confidence,
                llm_confidence=llm_conf,
                overall_confidence=overall_conf,
                confidence_method=method_desc,
                is_calibrated=is_calibrated,
            )

            # Evaluate verification needs
            flagged_fields, requires_review, review_notes = ExtractorService.evaluate_verification_needs(
                data=structured_data,
                doc_type=doc_type,
                ocr_confidence=confidence,
            )

            final_status = DocumentStatus.NEEDS_REVIEW if requires_review else DocumentStatus.EXTRACTED

            extraction_result = ExtractionResult(
                document_id=doc_id,
                document_type=doc_type,
                raw_text=raw_text,
                page_count=page_count,
                ocr_engine=ocr_engine,
                confidence=confidence,
                confidence_method=conf_method,
                confidence_info=confidence_info,
                structured_data=structured_data,
                llm_extracted=llm_used,
                fields_requiring_verification=flagged_fields,
                requires_verification=requires_review,
                extraction_notes=notes,
                review_notes=review_notes,
                disclaimer=settings.MEDICAL_DISCLAIMER,
            )

            # Persist extraction and relational entities in Supabase if configured
            if cls._should_use_supabase(user_id):
                try:
                    DatabaseService.save_document_extraction_unified(
                        doc_id=doc_id,
                        user_id=user_id,
                        status=final_status,
                        document_type=doc_type,
                        raw_text=raw_text,
                        ocr_engine=ocr_engine,
                        confidence=confidence,
                        confidence_method=conf_method,
                        requires_verification=requires_review,
                        fields_requiring_verification=flagged_fields,
                        structured_data=structured_data.model_dump(mode="json") if structured_data else None,
                        extraction_result=extraction_result.model_dump(mode="json") if doc_type != DocumentType.NON_MEDICAL and final_status != DocumentStatus.UNSUPPORTED else None,
                        error_message=None,
                    )
                except Exception as e:
                    logger.warning("Supabase persistence warning: %s", str(e))

            # Update local record
            now = datetime.now(timezone.utc)
            record["status"] = final_status.value
            record["document_type"] = doc_type.value
            record["raw_text"] = raw_text
            record["extraction_result"] = extraction_result.model_dump(mode="json")
            record["requires_verification"] = requires_review
            record["updated_at"] = now.isoformat()
            cls._save_record(doc_id, record)

            # Audit log
            AuditService.log_event(
                action=AuditAction.DOCUMENT_EXTRACT,
                resource_type="medical_document",
                resource_id=doc_id,
                user_id=user_id,
                metadata={"document_type": doc_type.value, "ocr_engine": ocr_engine},
            )

            return cls._build_detail_response(record)

        except HealthSyncException as e:
            now = datetime.now(timezone.utc)
            record["status"] = DocumentStatus.FAILED.value
            record["error_message"] = e.message
            record["updated_at"] = now.isoformat()
            cls._save_record(doc_id, record)
            raise e

        except Exception as e:
            now = datetime.now(timezone.utc)
            record["status"] = DocumentStatus.FAILED.value
            record["error_message"] = str(e)
            record["updated_at"] = now.isoformat()
            cls._save_record(doc_id, record)
            raise DocumentProcessingException(f"Document extraction failed: {str(e)}")

    # ==========================================================================
    # Status, Detail, and Review Queries
    # ==========================================================================

    @classmethod
    def get_document_status(cls, doc_id: str, user_id: str) -> DocumentStatusResponse:
        """Returns current operational status of the document after ownership verification."""
        record = cls.get_document_record(doc_id, user_id)
        return DocumentStatusResponse(
            document_id=doc_id,
            status=DocumentStatus(record["status"]),
            document_type=DocumentType(record.get("document_type", DocumentType.OTHER.value)),
            error_message=record.get("error_message"),
            updated_at=datetime.fromisoformat(str(record["updated_at"])),
        )

    @classmethod
    def get_document_detail(cls, doc_id: str, user_id: str) -> DocumentDetailResponse:
        """Returns comprehensive document information after ownership verification."""
        record = cls.get_document_record(doc_id, user_id)
        return cls._build_detail_response(record)

    @classmethod
    def get_document_review(cls, doc_id: str, user_id: str) -> DocumentReviewResponse:
        """Returns a formatted review payload after ownership verification."""
        record = cls.get_document_record(doc_id, user_id)

        AuditService.log_event(
            action=AuditAction.DOCUMENT_REVIEW,
            resource_type="medical_document",
            resource_id=doc_id,
            user_id=user_id,
        )

        extraction_data = record.get("extraction_result")
        current_status_str = record.get("status") or DocumentStatus.UPLOADED.value
        try:
            status_enum = DocumentStatus(current_status_str)
        except ValueError:
            status_enum = DocumentStatus.UPLOADED

        raw_type_str = record.get("document_type") or DocumentType.OTHER.value
        try:
            type_enum = DocumentType(raw_type_str)
        except ValueError:
            type_enum = DocumentType.OTHER

        if not extraction_data:
            is_unsupported = (status_enum == DocumentStatus.UNSUPPORTED or type_enum == DocumentType.NON_MEDICAL)
            return DocumentReviewResponse(
                document_id=doc_id,
                document_category=type_enum,
                processing_status=status_enum,
                extracted_information=None,
                extraction_engine_used="not_yet_extracted" if not is_unsupported else "classifier",
                ocr_text=record.get("raw_text") or "",
                confidence_information=ConfidenceInformation(
                    ocr_confidence=None,
                    llm_confidence=None,
                    overall_confidence=0.0 if is_unsupported else None,
                    confidence_method="non_medical" if is_unsupported else "unavailable",
                    is_calibrated=is_unsupported,
                ),
                fields_requiring_verification=[],
                requires_verification=False,
                review_notes=record.get("error_message") or (
                    "Non-medical or unsupported document." if is_unsupported else "Document uploaded. Extraction has not completed yet."
                ),
                medical_disclaimer=settings.MEDICAL_DISCLAIMER,
            )

        ext_result = ExtractionResult.model_validate(extraction_data)
        conf_info = ext_result.confidence_info or ConfidenceInformation(
            ocr_confidence=ext_result.confidence,
            llm_confidence=None,
            overall_confidence=ext_result.confidence,
            confidence_method=ext_result.confidence_method or "unavailable",
            is_calibrated=ext_result.confidence is not None,
        )

        return DocumentReviewResponse(
            document_id=doc_id,
            document_category=ext_result.document_type,
            processing_status=status_enum,
            extracted_information=ext_result.structured_data,
            extraction_engine_used=ext_result.ocr_engine,
            ocr_text=ext_result.raw_text,
            confidence_information=conf_info,
            fields_requiring_verification=ext_result.fields_requiring_verification,
            requires_verification=ext_result.requires_verification,
            review_notes=ext_result.review_notes or record.get("error_message"),
            medical_disclaimer=settings.MEDICAL_DISCLAIMER,
        )

    @classmethod
    def list_user_documents(cls, user_id: str) -> List[DocumentDetailResponse]:
        """Lists all medical documents owned by the authenticated user."""
        cls._ensure_demo_records_seeded(user_id)

        if cls._should_use_supabase(user_id):
            docs = DatabaseService.list_user_documents(user_id)
            return [cls._build_detail_response(d) for d in docs]

        all_recs = cls._load_all_records()
        user_docs = [r for r in all_recs.values() if r.get("user_id") == user_id]
        return [cls._build_detail_response(r) for r in user_docs]

    @classmethod
    def delete_document(cls, doc_id: str, user_id: str) -> None:
        """Deletes a document after verifying user ownership."""
        cls.get_document_record(doc_id, user_id)

        if cls._should_use_supabase(user_id):
            DatabaseService.delete_document(doc_id, user_id)

        with cls._lock:
            records = cls._load_all_records()
            if doc_id in records:
                # Remove file if exists
                file_name = records[doc_id].get("stored_filename")
                if file_name:
                    file_p = ensure_upload_dir() / file_name
                    if file_p.exists():
                        file_p.unlink(missing_ok=True)
                del records[doc_id]
                with open(cls._metadata_file, "w", encoding="utf-8") as f:
                    json.dump(records, f, indent=2, default=str)

        AuditService.log_event(
            action=AuditAction.DOCUMENT_DELETE,
            resource_type="medical_document",
            resource_id=doc_id,
            user_id=user_id,
        )

    @classmethod
    def get_document_file_path(cls, doc_id: str, user_id: str) -> Path:
        """Returns the local filesystem path of the document after verifying ownership."""
        record = cls.get_document_record(doc_id, user_id)
        stored_filename = record.get("stored_filename") or f"{doc_id}_{record.get('original_filename', 'document.pdf')}"
        file_path = ensure_upload_dir() / stored_filename
        if not file_path.exists():
            # If Supabase storage is configured, attempt retrieval and local cache
            if cls._should_use_supabase(user_id):
                try:
                    storage_path = record.get("storage_path") or f"{user_id}/{doc_id}/{record.get('original_filename', 'document.pdf')}"
                    file_bytes = StorageService.download_file(storage_path, user_id)
                    with open(file_path, "wb") as f:
                        f.write(file_bytes)
                    return file_path
                except Exception as e:
                    logger.warning("Could not retrieve file from Supabase storage: %s", str(e))
            raise EntityNotFoundException("Document file on disk", doc_id)
        return file_path

    @classmethod
    async def get_download_url(cls, doc_id: str, user_id: str) -> Dict[str, Any]:
        """Generates a signed storage URL if Supabase is active, or local download URL."""
        record = cls.get_document_record(doc_id, user_id)
        if cls._should_use_supabase(user_id):
            try:
                storage_path = record.get("storage_path") or f"{user_id}/{doc_id}/{record.get('original_filename')}"
                url = await StorageService.create_signed_url(storage_path, expires_in=3600)
                return {"download_url": url, "expires_in_seconds": 3600}
            except Exception as e:
                logger.warning("Supabase signed URL error: %s", str(e))

        return {
            "download_url": f"/api/v1/documents/{doc_id}/file",
            "expires_in_seconds": 86400,
        }

    @classmethod
    def update_review(cls, doc_id: str, user_id: str, corrections: Dict[str, Any]) -> Dict[str, Any]:
        """Updates extracted medical information with user corrections."""
        record = cls.get_document_record(doc_id, user_id)

        # Do not allow unsupported or non-medical documents to be saved as verified clinical records
        status_val = record.get("status")
        doc_type_val = record.get("document_type")
        if status_val == DocumentStatus.UNSUPPORTED.value or doc_type_val == DocumentType.NON_MEDICAL.value:
            from backend.app.core.exceptions import ValidationException
            raise ValidationException("Cannot save clinical corrections on an unsupported or non-medical document.")

        now = datetime.now(timezone.utc)

        with cls._lock:
            records = cls._load_all_records()
            if doc_id in records:
                target_rec = records[doc_id]
                target_rec["status"] = DocumentStatus.EXTRACTED.value
                target_rec["needs_human_review"] = False
                target_rec["requires_verification"] = False
                target_rec["user_reviewed"] = True
                target_rec["user_reviewed_at"] = now.isoformat()

                ext = target_rec.setdefault("extraction_result", {})
                if "structured_data" in corrections:
                    ext["structured_data"] = corrections["structured_data"]
                if "notes" in corrections:
                    target_rec["review_notes"] = corrections["notes"]

                target_rec["updated_at"] = now.isoformat()
                with open(cls._metadata_file, "w", encoding="utf-8") as f:
                    json.dump(records, f, indent=2, default=str)

        # Persist to Supabase if configured
        if cls._should_use_supabase(user_id):
            try:
                DatabaseService.update_document_review(
                    doc_id=doc_id,
                    user_id=user_id,
                    structured_data=corrections.get("structured_data", {}),
                    review_notes=corrections.get("notes"),
                )
            except Exception as e:
                logger.warning("Supabase update_document_review warning: %s", str(e))

        AuditService.log_event(
            action=AuditAction.REVIEW_COMPLETE,
            resource_type="medical_document",
            resource_id=doc_id,
            user_id=user_id,
            metadata={"corrections_applied": True},
        )

        return {"status": "success", "message": "Review corrections saved successfully."}

    @classmethod
    def verify_as_clinician(cls, doc_id: str, clinician_user_id: str, verification_data: Dict[str, Any]) -> Dict[str, Any]:
        """Clinician verification service orchestration."""
        record = cls.get_document_record(doc_id, clinician_user_id)
        status_val = record.get("status")
        doc_type_val = record.get("document_type")
        if status_val == DocumentStatus.UNSUPPORTED.value or doc_type_val == DocumentType.NON_MEDICAL.value:
            from backend.app.core.exceptions import ValidationException
            raise ValidationException("Non-medical or unsupported documents are ineligible for clinician verification.")

        now = datetime.now(timezone.utc)
        with cls._lock:
            records = cls._load_all_records()
            if doc_id in records:
                target_rec = records[doc_id]
                target_rec["status"] = DocumentStatus.EXTRACTED.value
                target_rec["needs_human_review"] = False
                target_rec["requires_verification"] = False
                target_rec["clinician_verified"] = True
                target_rec["clinician_verified_at"] = now.isoformat()
                target_rec["verified_by_user_id"] = clinician_user_id

                ext = target_rec.setdefault("extraction_result", {})
                if "structured_data" in verification_data:
                    ext["structured_data"] = verification_data["structured_data"]
                v_state = ext.setdefault("verification_state", {})
                v_state["clinician_verified"] = True
                v_state["clinician_verified_at"] = now.isoformat()
                v_state["verified_by_user_id"] = clinician_user_id
                v_state["requires_verification"] = False

                if "notes" in verification_data:
                    target_rec["review_notes"] = verification_data["notes"]

                target_rec["updated_at"] = now.isoformat()
                with open(cls._metadata_file, "w", encoding="utf-8") as f:
                    json.dump(records, f, indent=2, default=str)

        if cls._should_use_supabase(clinician_user_id):
            try:
                DatabaseService.verify_document_as_clinician(
                    doc_id=doc_id,
                    user_id=clinician_user_id,
                    verified_structured_data=verification_data.get("structured_data", {}),
                    review_notes=verification_data.get("notes"),
                )
            except Exception as e:
                logger.warning("Supabase verify_document_as_clinician warning: %s", str(e))

        AuditService.log_event(
            action=AuditAction.REVIEW_COMPLETE,
            resource_type="medical_document",
            resource_id=doc_id,
            user_id=clinician_user_id,
            metadata={"clinician_verified": True},
        )
        return {"status": "success", "message": "Clinician verification completed successfully."}

    @classmethod
    def create_share(
        cls, doc_id: str, owner_id: str, payload: ShareDocumentRequest
    ) -> DocumentShareResponse:
        """Shares a document with another email address."""
        record = cls.get_document_record(doc_id, owner_id)

        now = datetime.now(timezone.utc)
        import uuid
        share_id = str(uuid.uuid4())
        from datetime import timedelta
        expires_at = now + timedelta(days=payload.expires_in_days or 7)

        share_dict = {
            "share_id": share_id,
            "document_id": doc_id,
            "owner_id": owner_id,
            "shared_with_email": str(payload.shared_with_email),
            "permission": payload.permission,
            "expires_at": expires_at.isoformat(),
            "is_revoked": False,
            "created_at": now.isoformat(),
        }

        # Store locally
        with cls._lock:
            records = cls._load_all_records()
            if doc_id in records:
                records[doc_id].setdefault("shares", []).append(share_dict)
                with open(cls._metadata_file, "w", encoding="utf-8") as f:
                    json.dump(records, f, indent=2, default=str)

        # Store in Supabase if configured
        if cls._should_use_supabase(owner_id):
            try:
                DatabaseService.create_share(
                    doc_id=doc_id,
                    owner_id=owner_id,
                    shared_with_email=str(payload.shared_with_email),
                    permission=payload.permission,
                    expires_in_days=payload.expires_in_days or 7,
                )
            except Exception as e:
                logger.warning("Supabase share creation warning: %s", str(e))

        AuditService.log_event(
            action=AuditAction.SHARE_CREATE,
            resource_type="document_share",
            resource_id=share_id,
            user_id=owner_id,
            metadata={"document_id": doc_id, "recipient": str(payload.shared_with_email)},
        )

        return DocumentShareResponse(
            share_id=share_id,
            document_id=doc_id,
            shared_with_email=str(payload.shared_with_email),
            permission=payload.permission,
            expires_at=expires_at,
            is_revoked=False,
            created_at=now,
        )

    @classmethod
    def reclassify_user_documents(cls, user_id: str, dry_run: bool = False) -> Dict[str, Any]:
        """
        Controlled, idempotent migration/reclassification for existing documents.
        Identifies documents with raw_text where current classification is OTHER, or
        where ClassifierService detects non-medical content.
        Preserves original document files and OCR text, but updates classification,
        removes invalid clinical entities, and purges RAG vector chunks.
        """
        reclassified = []
        all_recs = cls._load_all_records()
        user_doc_ids = [k for k, v in all_recs.items() if v.get("user_id") == user_id]

        if cls._should_use_supabase(user_id):
            try:
                db_docs = DatabaseService.list_user_documents(user_id)
                for d in db_docs:
                    if d["id"] not in user_doc_ids:
                        user_doc_ids.append(d["id"])
            except Exception as e:
                logger.warning("Could not list database documents for reclassification: %s", str(e))

        for doc_id in user_doc_ids:
            rec = None
            try:
                rec = cls.get_document_record(doc_id, user_id)
            except Exception:
                continue

            raw_text = rec.get("raw_text")
            if not raw_text:
                continue

            curr_type = rec.get("document_type")
            curr_status = rec.get("status")

            detected_type, conf, is_med, reason = ClassifierService.classify_document(raw_text)

            should_update = False
            if detected_type == DocumentType.NON_MEDICAL and (
                curr_type != DocumentType.NON_MEDICAL.value or curr_status != DocumentStatus.UNSUPPORTED.value
            ):
                should_update = True
            elif not is_med and detected_type == DocumentType.NON_MEDICAL and curr_type == DocumentType.OTHER.value:
                should_update = True

            if should_update:
                item_summary = {
                    "document_id": doc_id,
                    "filename": rec.get("original_filename"),
                    "previous_type": curr_type,
                    "previous_status": curr_status,
                    "new_type": DocumentType.NON_MEDICAL.value,
                    "new_status": DocumentStatus.UNSUPPORTED.value,
                    "reason": reason,
                }
                reclassified.append(item_summary)

                if not dry_run:
                    # Update local record
                    with cls._lock:
                        all_recs = cls._load_all_records()
                        if doc_id in all_recs:
                            all_recs[doc_id]["document_type"] = DocumentType.NON_MEDICAL.value
                            all_recs[doc_id]["status"] = DocumentStatus.UNSUPPORTED.value
                            all_recs[doc_id]["confidence"] = None
                            all_recs[doc_id]["requires_verification"] = False
                            all_recs[doc_id]["error_message"] = reason
                            all_recs[doc_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
                            if all_recs[doc_id].get("extraction_result"):
                                all_recs[doc_id]["extraction_result"]["document_type"] = DocumentType.NON_MEDICAL.value
                                all_recs[doc_id]["extraction_result"]["confidence"] = None
                                all_recs[doc_id]["extraction_result"]["structured_data"] = None
                                all_recs[doc_id]["extraction_result"]["requires_verification"] = False
                            cls._save_record(doc_id, all_recs[doc_id])

                    # Delete chunks from RAG index
                    from backend.app.services.rag_service import RAGAssistantService
                    RAGAssistantService.delete_document_chunks(doc_id, user_id)

                    # Update Supabase if configured
                    if is_supabase_configured():
                        try:
                            DatabaseService.update_document_extraction(
                                doc_id=doc_id,
                                user_id=user_id,
                                status=DocumentStatus.UNSUPPORTED,
                                document_type=DocumentType.NON_MEDICAL,
                                raw_text=raw_text,
                                ocr_engine=rec.get("ocr_engine", "unknown"),
                                confidence=None,
                                confidence_method="non_medical_reclassification",
                                requires_verification=False,
                                fields_requiring_verification=[],
                                error_message=reason,
                            )
                            DatabaseService.clean_clinical_entities(doc_id, user_id)
                        except Exception as e:
                            logger.warning("Supabase reclassification update error: %s", str(e))

                    AuditService.log_event(
                        action=AuditAction.DOCUMENT_REVIEW,
                        resource_type="medical_document",
                        resource_id=doc_id,
                        user_id=user_id,
                        metadata={"action": "reclassify_to_non_medical", "reason": reason},
                    )

        return {
            "user_id": user_id,
            "dry_run": dry_run,
            "scanned_documents_count": len(user_doc_ids),
            "reclassified_count": len(reclassified),
            "reclassified_documents": reclassified,
        }

    @classmethod
    def _build_detail_response(cls, record: Dict[str, Any]) -> DocumentDetailResponse:
        extraction = None
        if record.get("extraction_result"):
            try:
                extraction = ExtractionResult.model_validate(record["extraction_result"])
            except Exception as e:
                logger.warning("ExtractionResult validation notice: %s", str(e))
                extraction = None

        doc_id = str(record.get("id") or record.get("document_id") or "")
        orig_filename = str(record.get("original_filename") or record.get("filename") or "unnamed_document")

        raw_status = record.get("status") or record.get("processing_status") or DocumentStatus.UPLOADED.value
        try:
            status_enum = DocumentStatus(raw_status)
        except ValueError:
            status_enum = DocumentStatus.UPLOADED

        raw_type = record.get("document_type") or DocumentType.OTHER.value
        try:
            type_enum = DocumentType(raw_type)
        except ValueError:
            type_enum = DocumentType.OTHER

        # Auto-check if previously classified as OTHER but text is non-medical
        raw_text = record.get("raw_text")
        if raw_text and type_enum in [DocumentType.OTHER, DocumentType.NON_MEDICAL]:
            det_type, _, _, _ = ClassifierService.classify_document(raw_text)
            if det_type == DocumentType.NON_MEDICAL:
                type_enum = DocumentType.NON_MEDICAL
                status_enum = DocumentStatus.UNSUPPORTED

        is_non_medical = (
            type_enum == DocumentType.NON_MEDICAL
            or status_enum == DocumentStatus.UNSUPPORTED
        )

        if is_non_medical:
            conf_val = None
            req_verif = False
            status_enum = DocumentStatus.UNSUPPORTED
            type_enum = DocumentType.NON_MEDICAL
            extraction = None
        else:
            if extraction is None:
                user_id = record.get("user_id")
                if user_id:
                    try:
                        hydrated = DatabaseService.hydrate_extraction_result(record, user_id)
                        if hydrated:
                            extraction = ExtractionResult.model_validate(hydrated)
                    except Exception as e:
                        logger.warning("Hydrated ExtractionResult validation notice: %s", str(e))
                        extraction = None

            conf_val = record.get("confidence")
            if conf_val is None and extraction:
                conf_val = extraction.confidence

            req_verif = record.get("requires_verification")
            if req_verif is None:
                req_verif = extraction.requires_verification if extraction else False

        now = datetime.now(timezone.utc)
        created_str = record.get("created_at")
        updated_str = record.get("updated_at") or created_str
        try:
            created_dt = datetime.fromisoformat(str(created_str)) if created_str else now
        except Exception:
            created_dt = now

        try:
            updated_dt = datetime.fromisoformat(str(updated_str)) if updated_str else now
        except Exception:
            updated_dt = now

        file_size = record.get("file_size_bytes")
        if not isinstance(file_size, int):
            file_size = 0

        return DocumentDetailResponse(
            document_id=doc_id,
            id=doc_id,
            original_filename=orig_filename,
            filename=orig_filename,
            document_type=type_enum,
            file_size_bytes=file_size,
            mime_type=record.get("mime_type") or "application/pdf",
            status=status_enum,
            processing_status=status_enum.value,
            ocr_confidence=conf_val,
            confidence_score=conf_val,
            needs_human_review=bool(req_verif),
            raw_text=raw_text,
            extraction_result=extraction,
            error_message=record.get("error_message"),
            created_at=created_dt,
            updated_at=updated_dt,
            disclaimer=settings.MEDICAL_DISCLAIMER,
        )
