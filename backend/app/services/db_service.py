import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from backend.app.core.config import settings
from backend.app.core.exceptions import (
    EntityNotFoundException,
    ForbiddenException,
    SupabaseNotConfiguredException,
)
from backend.app.core.db import (
    DatabaseConnectionException,
    is_direct_db_configured,
    get_db_connection,
    get_rls_connection,
)
from backend.app.core.supabase_client import is_supabase_configured, get_supabase_admin_client
from backend.app.schemas.document import (
    DocumentType,
    DocumentStatus,
    PrescriptionData,
    LabReportData,
    ExtractionResult,
)

logger = logging.getLogger("healthsync")


def _serialize_db_row(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Converts native database types (UUID, datetime) into JSON-compatible primitives."""
    if not row:
        return row
    res = {}
    for k, v in row.items():
        if isinstance(v, uuid.UUID):
            res[k] = str(v)
        elif isinstance(v, datetime):
            res[k] = v.isoformat()
        else:
            res[k] = v
    return res


class DatabaseService:
    """
    Data access service for Supabase PostgreSQL tables and direct PostgreSQL.
    All operations strictly enforce authenticated user ownership and RLS.
    """

    @classmethod
    def create_document_record(
        cls,
        doc_id: str,
        user_id: str,
        filename: str,
        storage_path: str,
        mime_type: str,
        file_size_bytes: int,
    ) -> Dict[str, Any]:
        """Inserts a new record into public.medical_documents."""
        if is_direct_db_configured():
            with get_rls_connection(user_id=user_id, role="authenticated") as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO public.medical_documents (
                            id, user_id, original_filename, storage_path,
                            mime_type, file_size_bytes, document_type, status,
                            created_at, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, clock_timestamp(), clock_timestamp()
                        ) RETURNING *;
                        """,
                        (
                            doc_id,
                            user_id,
                            filename,
                            storage_path,
                            mime_type,
                            file_size_bytes,
                            DocumentType.OTHER.value,
                            DocumentStatus.UPLOADED.value,
                        ),
                    )
                    row = cur.fetchone()
                    if not row:
                        raise DatabaseConnectionException("Failed to persist document metadata in database.")
                    return _serialize_db_row(row)

        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        client = get_supabase_admin_client()
        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "id": doc_id,
            "user_id": user_id,
            "original_filename": filename,
            "storage_path": storage_path,
            "mime_type": mime_type,
            "file_size_bytes": file_size_bytes,
            "document_type": DocumentType.OTHER.value,
            "status": DocumentStatus.UPLOADED.value,
            "created_at": now,
            "updated_at": now,
        }

        res = client.table("medical_documents").insert(payload).execute()
        if not res.data:
            raise SupabaseNotConfiguredException("Failed to persist document metadata in database.")
        return res.data[0]

    @classmethod
    def hydrate_extraction_result(cls, doc: Dict[str, Any], user_id: str) -> Optional[Dict[str, Any]]:
        """
        Reconstructs structured extraction_result for a document record.
        1. Non-medical and unsupported documents strictly return None.
        2. Prescriptions are reconstructed from extracted_prescriptions & extracted_medications tables.
        3. Lab reports are reconstructed from extracted_lab_reports & extracted_lab_results tables.
        4. Discharge summaries & consultations are reconstructed from persistent metadata or verbatim raw_text.
        5. Returns None if no valid clinical extraction exists.
        """
        if not doc or not isinstance(doc, dict):
            return None

        doc_id = str(doc.get("id") or doc.get("document_id") or "")
        doc_type_raw = str(doc.get("document_type") or "").lower().strip()
        status_raw = str(doc.get("status") or "").lower().strip()

        ALLOWED_MEDICAL_TYPES = {
            "prescription",
            "lab_report",
            "blood_test",
            "laboratory_report",
            "discharge_summary",
            "consultation_record",
            "imaging_report",
        }

        # Non-medical, unsupported, failed, or pre-extraction documents have no clinical extraction result
        if doc_type_raw not in ALLOWED_MEDICAL_TYPES or status_raw in ["unsupported", "uploaded", "failed", "processing"]:
            return None

        client = get_supabase_admin_client() if is_supabase_configured() else None
        structured_data = None
        raw_text = doc.get("raw_text") or ""

        # Strategy 0: Direct JSONB extraction_result if present and populated
        existing_jsonb = doc.get("extraction_result")
        if isinstance(existing_jsonb, dict) and existing_jsonb.get("structured_data"):
            # Ensure document_id, raw_text, and disclaimers are preserved
            if not existing_jsonb.get("document_id"):
                existing_jsonb["document_id"] = doc_id
            if not existing_jsonb.get("raw_text") and raw_text:
                existing_jsonb["raw_text"] = raw_text
            if not existing_jsonb.get("disclaimer"):
                existing_jsonb["disclaimer"] = settings.MEDICAL_DISCLAIMER
            try:
                validated = ExtractionResult.model_validate(existing_jsonb)
                return validated.model_dump(mode="json")
            except Exception as e:
                logger.debug("ExtractionResult validation on existing JSONB notice: %s", str(e))
                # If schema validation fails on wrapper, extract structured_data directly
                structured_data = existing_jsonb.get("structured_data")
        elif isinstance(existing_jsonb, str):
            try:
                parsed = json.loads(existing_jsonb)
                if isinstance(parsed, dict) and parsed.get("structured_data"):
                    if not parsed.get("document_id"):
                        parsed["document_id"] = doc_id
                    if not parsed.get("raw_text") and raw_text:
                        parsed["raw_text"] = raw_text
                    if not parsed.get("disclaimer"):
                        parsed["disclaimer"] = settings.MEDICAL_DISCLAIMER
                    validated = ExtractionResult.model_validate(parsed)
                    return validated.model_dump(mode="json")
            except Exception:
                pass

        # Strategy 1: Reconstruct Prescription from relational tables
        if doc_type_raw == "prescription":
            rx_rows = []
            meds_rows = []
            if client:
                try:
                    rx_res = client.table("extracted_prescriptions").select("*").eq("document_id", doc_id).execute()
                    rx_rows = rx_res.data or []
                    meds_res = (
                        client.table("extracted_medications")
                        .select("*")
                        .eq("document_id", doc_id)
                        .order("created_at", desc=False)
                        .execute()
                    )
                    meds_rows = meds_res.data or []
                except Exception as e:
                    logger.debug("Prescription relational retrieval notice: %s", str(e))

            if rx_rows or meds_rows:
                rx_row = rx_rows[0] if rx_rows else {}
                meds_list = [
                    {
                        "name": m.get("name") or "Unknown",
                        "dosage": m.get("dosage"),
                        "frequency": m.get("frequency"),
                        "duration": m.get("duration"),
                        "instructions": m.get("instructions"),
                    }
                    for m in meds_rows
                ]
                structured_data = {
                    "patient_name": rx_row.get("patient_name"),
                    "doctor_name": rx_row.get("doctor_name"),
                    "clinic_or_hospital": rx_row.get("clinic_or_hospital"),
                    "prescription_date": rx_row.get("prescription_date"),
                    "diagnosis_text": rx_row.get("diagnosis_text"),
                    "medications": meds_list,
                }

        # Strategy 2: Reconstruct Lab Report from relational tables
        elif doc_type_raw in ["lab_report", "blood_test", "laboratory_report"]:
            lr_rows = []
            results_rows = []
            if client:
                try:
                    lr_res = client.table("extracted_lab_reports").select("*").eq("document_id", doc_id).execute()
                    lr_rows = lr_res.data or []
                    res_res = (
                        client.table("extracted_lab_results")
                        .select("*")
                        .eq("document_id", doc_id)
                        .order("created_at", desc=False)
                        .execute()
                    )
                    results_rows = res_res.data or []
                except Exception as e:
                    logger.debug("Lab report relational retrieval notice: %s", str(e))

            if lr_rows or results_rows:
                lr_row = lr_rows[0] if lr_rows else {}
                results_list = [
                    {
                        "test_name": r.get("test_name") or "Unknown",
                        "measured_value": r.get("measured_value"),
                        "unit": r.get("unit"),
                        "reference_range": r.get("reference_range"),
                        "test_category": r.get("test_category"),
                        "is_abnormal": bool(r.get("is_abnormal")),
                    }
                    for r in results_rows
                ]
                structured_data = {
                    "patient_name": lr_row.get("patient_name"),
                    "doctor_or_lab_name": lr_row.get("doctor_or_lab_name"),
                    "report_date": lr_row.get("report_date"),
                    "test_category": lr_row.get("test_category"),
                    "tests": results_list,
                }

        # Strategy 3: Check persistent local metadata store if available
        if not structured_data:
            meta_file = Path("uploads/metadata.json")
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        local_records = json.load(f)
                        if doc_id in local_records:
                            local_ext = local_records[doc_id].get("extraction_result")
                            if isinstance(local_ext, dict) and local_ext.get("structured_data"):
                                structured_data = local_ext["structured_data"]
                except Exception as e:
                    logger.debug("Local metadata fallback notice: %s", str(e))

        # Strategy 4: Deterministic raw_text extraction fallback
        if not structured_data and raw_text:
            try:
                from backend.app.services.extractor_service import ExtractorService
                if doc_type_raw == "discharge_summary":
                    ds_res = ExtractorService.extract_discharge_summary(raw_text)
                    structured_data = ds_res.model_dump(mode="json")
                elif doc_type_raw == "consultation_record":
                    cs_res = ExtractorService.extract_consultation(raw_text)
                    structured_data = cs_res.model_dump(mode="json")
                elif doc_type_raw == "prescription":
                    rx_res = ExtractorService.extract_prescription(raw_text)
                    structured_data = rx_res.model_dump(mode="json")
                elif doc_type_raw in ["lab_report", "blood_test", "laboratory_report"]:
                    lr_res = ExtractorService.extract_lab_report(raw_text)
                    structured_data = lr_res.model_dump(mode="json")
            except Exception as e:
                logger.debug("Deterministic raw_text extraction fallback notice: %s", str(e))

        if not structured_data:
            return None

        confidence = doc.get("confidence")
        conf_method = doc.get("confidence_method") or "rule_based_clinical"
        requires_review = bool(doc.get("requires_verification"))
        flagged = doc.get("fields_requiring_verification") or []

        ext_payload = {
            "document_id": doc_id,
            "document_type": doc_type_raw,
            "raw_text": raw_text,
            "page_count": doc.get("page_count") or 1,
            "ocr_engine": doc.get("ocr_engine") or "pdfplumber",
            "confidence": confidence,
            "confidence_method": conf_method,
            "confidence_info": {
                "ocr_confidence": confidence,
                "llm_confidence": None,
                "overall_confidence": confidence,
                "confidence_method": conf_method,
                "is_calibrated": confidence is not None,
            },
            "structured_data": structured_data,
            "llm_extracted": False,
            "fields_requiring_verification": flagged,
            "requires_verification": requires_review,
            "extraction_notes": None,
            "review_notes": doc.get("error_message") or (
                "Document has ambiguous fields requiring human review." if requires_review else "All fields verified clearly."
            ),
            "disclaimer": settings.MEDICAL_DISCLAIMER,
        }

        try:
            validated = ExtractionResult.model_validate(ext_payload)
            return validated.model_dump(mode="json")
        except Exception as e:
            logger.warning("ExtractionResult validation error during hydration for %s: %s", doc_id, str(e))
            return None

    @classmethod
    def get_document_record(cls, doc_id: str, user_id: str) -> Dict[str, Any]:
        """
        Retrieves a medical document record.
        Enforces user ownership or verified active share.
        Hydrates extraction_result from relational tables or persistent metadata.
        """
        if is_direct_db_configured():
            with get_rls_connection(user_id=user_id, role="authenticated") as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM public.medical_documents WHERE id = %s;",
                        (doc_id,),
                    )
                    row = cur.fetchone()

            if not row:
                # Under PostgreSQL RLS, documents not owned or shared are completely invisible.
                # Returning 404 prevents cross-user document ID enumeration (IDOR oracle).
                raise EntityNotFoundException("Medical Document", doc_id)

            doc = _serialize_db_row(row)
            doc["extraction_result"] = cls.hydrate_extraction_result(doc, user_id)
            return doc

        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        client = get_supabase_admin_client()
        res = client.table("medical_documents").select("*").eq("id", doc_id).execute()

        if not res.data:
            raise EntityNotFoundException("Medical Document", doc_id)

        doc = res.data[0]

        # Check ownership
        if doc["user_id"] != user_id:
            # Check if active share exists
            shares = client.table("document_shares").select("*").eq("document_id", doc_id).eq("shared_with_user_id", user_id).eq("is_revoked", False).execute()
            if not shares.data:
                raise ForbiddenException("Access denied. You do not own this document.")

        doc["extraction_result"] = cls.hydrate_extraction_result(doc, user_id)
        return doc

    @classmethod
    def list_user_documents(cls, user_id: str) -> List[Dict[str, Any]]:
        """Lists all medical documents owned by the user, ordered by creation date."""
        if is_direct_db_configured():
            with get_rls_connection(user_id=user_id, role="authenticated") as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT * FROM public.medical_documents
                        WHERE user_id = %s
                        ORDER BY created_at DESC;
                        """,
                        (user_id,),
                    )
                    rows = cur.fetchall()
            docs = [_serialize_db_row(r) for r in (rows or [])]
            for d in docs:
                d["extraction_result"] = cls.hydrate_extraction_result(d, user_id)
            return docs

        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        client = get_supabase_admin_client()
        res = (
            client.table("medical_documents")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        docs = res.data or []
        for d in docs:
            d["extraction_result"] = cls.hydrate_extraction_result(d, user_id)
        return docs

    @classmethod
    def save_document_extraction_unified(
        cls,
        doc_id: str,
        user_id: str,
        status: DocumentStatus,
        document_type: DocumentType,
        raw_text: str,
        ocr_engine: str,
        confidence: Optional[float],
        confidence_method: Optional[str],
        requires_verification: bool,
        fields_requiring_verification: List[str],
        structured_data: Optional[Dict[str, Any]] = None,
        extraction_result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Unified extraction persistence method.
        Attempts to call the atomic RPC save_document_extraction_atomic when available,
        falling back cleanly to transactional client operations while maintaining JSONB
        and relational projection synchronization.
        """
        # Non-medical and unsupported documents MUST have NULL extraction_result
        is_non_medical = document_type == DocumentType.NON_MEDICAL or status == DocumentStatus.UNSUPPORTED
        final_extraction = None if is_non_medical else (extraction_result or ({"document_type": document_type.value, "structured_data": structured_data} if structured_data else None))

        if is_direct_db_configured():
            cls.get_document_record(doc_id, user_id)
            # Direct PostgreSQL path: invoke RPC save_document_extraction_atomic with service_role context
            # FAIL-CLOSED: The atomic RPC is mandatory to guarantee atomic projection sync and validation.
            with get_rls_connection(user_id=user_id, role="service_role") as conn:
                with conn.cursor() as cur:
                    # Ensure raw_text, ocr_engine, and error_message are up to date
                    cur.execute(
                        """
                        UPDATE public.medical_documents
                        SET raw_text = %s, ocr_engine = %s, error_message = %s, confidence_method = %s
                        WHERE id = %s;
                        """,
                        (raw_text, ocr_engine, error_message, confidence_method, doc_id),
                    )
                    cur.execute(
                        """
                        SELECT public.save_document_extraction_atomic(
                            %s::uuid,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s::jsonb,
                            %s,
                            %s::text[]
                        ) AS result;
                        """,
                        (
                            doc_id,
                            document_type.value,
                            status.value,
                            float(confidence) if confidence is not None else None,
                            ocr_engine,
                            "v1.0",
                            json.dumps(structured_data) if (structured_data and not is_non_medical) else None,
                            requires_verification,
                            fields_requiring_verification or [],
                        ),
                    )
                    rpc_row = cur.fetchone()
                    cur.execute("SELECT * FROM public.medical_documents WHERE id = %s;", (doc_id,))
                    doc_row = cur.fetchone()
                    if not doc_row:
                        raise EntityNotFoundException("Medical Document", doc_id)
                    return _serialize_db_row(doc_row)

        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        cls.get_document_record(doc_id, user_id)
        client = get_supabase_admin_client()

        # Attempt RPC first (privileged path)
        try:
            rpc_res = client.rpc(
                "save_document_extraction_atomic",
                {
                    "p_document_id": doc_id,
                    "p_document_type": document_type.value,
                    "p_status": status.value,
                    "p_confidence_score": float(confidence) if confidence is not None else None,
                    "p_ocr_model": ocr_engine,
                    "p_pipeline_version": "v1.0",
                    "p_structured_data": structured_data if not is_non_medical else None,
                    "p_requires_verification": requires_verification,
                    "p_fields_requiring_verification": fields_requiring_verification,
                },
            ).execute()
            if rpc_res.data:
                return rpc_res.data
        except Exception as rpc_err:
            logger.debug("RPC save_document_extraction_atomic not yet applied or failed: %s; falling back to table update", str(rpc_err))

        # Fallback table-level updates
        payload: Dict[str, Any] = {
            "status": status.value,
            "document_type": document_type.value,
            "raw_text": raw_text,
            "ocr_engine": ocr_engine,
            "confidence": confidence,
            "confidence_method": confidence_method,
            "requires_verification": requires_verification,
            "fields_requiring_verification": fields_requiring_verification,
            "extraction_result": final_extraction,
            "error_message": error_message,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        res = client.table("medical_documents").update(payload).eq("id", doc_id).execute()

        # Synchronize projections: always clean obsolete projections first
        cls.clean_clinical_entities(doc_id, user_id)
        if not is_non_medical and structured_data:
            if document_type == DocumentType.PRESCRIPTION:
                try:
                    p_data = PrescriptionData.model_validate(structured_data)
                    cls.save_prescription_entities(doc_id, user_id, p_data)
                except Exception as ex:
                    logger.debug("Prescription projection sync warning: %s", str(ex))
            elif document_type in [DocumentType.LAB_REPORT, DocumentType.BLOOD_TEST]:
                try:
                    l_data = LabReportData.model_validate(structured_data)
                    cls.save_lab_report_entities(doc_id, user_id, l_data)
                except Exception as ex:
                    logger.debug("Lab report projection sync warning: %s", str(ex))

        return res.data[0] if res.data else {}

    @classmethod
    def update_document_extraction(
        cls,
        doc_id: str,
        user_id: str,
        status: DocumentStatus,
        document_type: DocumentType,
        raw_text: str,
        ocr_engine: str,
        confidence: Optional[float],
        confidence_method: Optional[str],
        requires_verification: bool,
        fields_requiring_verification: List[str],
        error_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Updates document status, classification, and OCR extraction metadata."""
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        # Check ownership first
        cls.get_document_record(doc_id, user_id)

        client = get_supabase_admin_client()
        payload = {
            "status": status.value,
            "document_type": document_type.value,
            "raw_text": raw_text,
            "ocr_engine": ocr_engine,
            "confidence": confidence,
            "confidence_method": confidence_method,
            "requires_verification": requires_verification,
            "fields_requiring_verification": fields_requiring_verification,
            "error_message": error_message,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        res = client.table("medical_documents").update(payload).eq("id", doc_id).execute()
        return res.data[0] if res.data else {}

    @classmethod
    def save_prescription_entities(
        cls, doc_id: str, user_id: str, data: PrescriptionData
    ) -> str:
        """Stores structured prescription entities into relational tables."""
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        client = get_supabase_admin_client()

        # Insert into extracted_prescriptions
        rx_payload = {
            "document_id": doc_id,
            "user_id": user_id,
            "patient_name": data.patient_name,
            "doctor_name": data.doctor_name,
            "clinic_or_hospital": data.clinic_or_hospital,
            "prescription_date": data.prescription_date,
            "diagnosis_text": data.diagnosis_text,
        }
        res = client.table("extracted_prescriptions").insert(rx_payload).execute()
        rx_id = res.data[0]["id"]

        # Insert medications
        if data.medications:
            meds_payload = [
                {
                    "prescription_id": rx_id,
                    "document_id": doc_id,
                    "user_id": user_id,
                    "name": m.name,
                    "dosage": m.dosage,
                    "frequency": m.frequency,
                    "duration": m.duration,
                    "instructions": m.instructions,
                }
                for m in data.medications
            ]
            client.table("extracted_medications").insert(meds_payload).execute()

        return rx_id

    @classmethod
    def save_lab_report_entities(
        cls, doc_id: str, user_id: str, data: LabReportData
    ) -> str:
        """Stores structured laboratory report entities into relational tables."""
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        client = get_supabase_admin_client()

        # Insert into extracted_lab_reports
        lab_payload = {
            "document_id": doc_id,
            "user_id": user_id,
            "patient_name": data.patient_name,
            "doctor_or_lab_name": data.doctor_or_lab_name,
            "report_date": data.report_date,
            "test_category": data.test_category,
        }
        res = client.table("extracted_lab_reports").insert(lab_payload).execute()
        lab_id = res.data[0]["id"]

        # Insert lab test results
        if data.tests:
            results_payload = [
                {
                    "lab_report_id": lab_id,
                    "document_id": doc_id,
                    "user_id": user_id,
                    "test_name": t.test_name,
                    "measured_value": t.measured_value,
                    "unit": t.unit,
                    "reference_range": t.reference_range,
                    "test_category": t.test_category,
                    "is_abnormal": t.is_abnormal or False,
                }
                for t in data.tests
            ]
            client.table("extracted_lab_results").insert(results_payload).execute()

        return lab_id

    @classmethod
    def update_document_review(
        cls,
        doc_id: str,
        user_id: str,
        structured_data: Dict[str, Any],
        review_notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Persists human review corrections and marks verification complete.
        Calls RPC save_document_patient_review_atomic when available.
        FAIL-CLOSED: Enforces patient ownership, 3-way audit diff in document_review_history,
        and projection synchronization in direct PostgreSQL mode.
        """
        if is_direct_db_configured():
            rec = cls.get_document_record(doc_id, user_id)
            with get_rls_connection(user_id=user_id, role="authenticated") as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT public.save_document_patient_review_atomic(
                            %s::uuid,
                            %s::jsonb,
                            %s
                        ) AS result;
                        """,
                        (doc_id, json.dumps(structured_data), review_notes),
                    )
                    rpc_row = cur.fetchone()
                    cur.execute("SELECT * FROM public.medical_documents WHERE id = %s;", (doc_id,))
                    doc_row = cur.fetchone()
                    if not doc_row:
                        raise EntityNotFoundException("Medical Document", doc_id)
                    return _serialize_db_row(doc_row)

        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        rec = cls.get_document_record(doc_id, user_id)
        client = get_supabase_admin_client()

        # Attempt RPC first (authenticated document owner path)
        try:
            rpc_res = client.rpc(
                "save_document_patient_review_atomic",
                {
                    "p_document_id": doc_id,
                    "p_corrected_structured_data": structured_data,
                    "p_review_notes": review_notes,
                },
            ).execute()
            if rpc_res.data:
                return rpc_res.data
        except Exception as rpc_err:
            logger.debug("RPC save_document_patient_review_atomic not yet applied or failed: %s; falling back to direct update", str(rpc_err))

        now_iso = datetime.now(timezone.utc).isoformat()
        existing_ext = rec.get("extraction_result") or {}
        existing_ext["structured_data"] = structured_data
        v_state = existing_ext.setdefault("verification_state", {})
        v_state["user_reviewed"] = True
        v_state["user_reviewed_at"] = now_iso

        payload: Dict[str, Any] = {
            "status": DocumentStatus.EXTRACTED.value,
            "requires_verification": False,
            "fields_requiring_verification": [],
            "user_reviewed": True,
            "user_reviewed_at": now_iso,
            "extraction_result": existing_ext,
            "updated_at": now_iso,
        }
        res = client.table("medical_documents").update(payload).eq("id", doc_id).execute()

        # Synchronize projections with corrected data
        doc_type_raw = str(rec.get("document_type") or "").lower().strip()
        if doc_type_raw == "prescription":
            try:
                cls.clean_clinical_entities(doc_id, user_id)
                p_data = PrescriptionData.model_validate(structured_data)
                cls.save_prescription_entities(doc_id, user_id, p_data)
            except Exception as e:
                logger.debug("Review prescription projection sync notice: %s", str(e))
        elif doc_type_raw in ["lab_report", "blood_test", "laboratory_report"]:
            try:
                cls.clean_clinical_entities(doc_id, user_id)
                l_data = LabReportData.model_validate(structured_data)
                cls.save_lab_report_entities(doc_id, user_id, l_data)
            except Exception as e:
                logger.debug("Review lab report projection sync notice: %s", str(e))

        return res.data[0] if res.data else {}

    @classmethod
    def verify_document_as_clinician(
        cls,
        doc_id: str,
        user_id: str,
        verified_structured_data: Dict[str, Any],
        review_notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Clinician verification method.
        Calls RPC verify_document_as_clinician_atomic when available.
        FAIL-CLOSED: Validates approved clinician status, license snapshot, audit history,
        and projection synchronization in direct PostgreSQL mode.
        """
        if is_direct_db_configured():
            rec = cls.get_document_record(doc_id, user_id)
            with get_rls_connection(user_id=user_id, role="authenticated") as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT public.verify_document_as_clinician_atomic(
                            %s::uuid,
                            %s::jsonb,
                            %s
                        ) AS result;
                        """,
                        (doc_id, json.dumps(verified_structured_data), review_notes),
                    )
                    rpc_row = cur.fetchone()
                    cur.execute("SELECT * FROM public.medical_documents WHERE id = %s;", (doc_id,))
                    doc_row = cur.fetchone()
                    if not doc_row:
                        raise EntityNotFoundException("Medical Document", doc_id)
                    return _serialize_db_row(doc_row)

        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        rec = cls.get_document_record(doc_id, user_id)
        client = get_supabase_admin_client()

        # Attempt RPC first
        try:
            rpc_res = client.rpc(
                "verify_document_as_clinician_atomic",
                {
                    "p_document_id": doc_id,
                    "p_verified_structured_data": verified_structured_data,
                    "p_review_notes": review_notes,
                },
            ).execute()
            if rpc_res.data:
                return rpc_res.data
        except Exception as rpc_err:
            logger.debug("RPC verify_document_as_clinician_atomic notice: %s", str(rpc_err))

        now_iso = datetime.now(timezone.utc).isoformat()
        existing_ext = rec.get("extraction_result") or {}
        existing_ext["structured_data"] = verified_structured_data
        v_state = existing_ext.setdefault("verification_state", {})
        v_state["clinician_verified"] = True
        v_state["clinician_verified_at"] = now_iso
        v_state["verified_by_user_id"] = user_id
        v_state["requires_verification"] = False

        payload: Dict[str, Any] = {
            "status": DocumentStatus.EXTRACTED.value,
            "requires_verification": False,
            "fields_requiring_verification": [],
            "clinician_verified": True,
            "clinician_verified_at": now_iso,
            "verified_by_user_id": user_id,
            "extraction_result": existing_ext,
            "updated_at": now_iso,
        }
        res = client.table("medical_documents").update(payload).eq("id", doc_id).execute()

        # Synchronize projections
        doc_type_raw = str(rec.get("document_type") or "").lower().strip()
        if doc_type_raw == "prescription":
            try:
                cls.clean_clinical_entities(doc_id, user_id)
                p_data = PrescriptionData.model_validate(verified_structured_data)
                cls.save_prescription_entities(doc_id, user_id, p_data)
            except Exception as e:
                logger.debug("Clinician verify prescription projection sync notice: %s", str(e))
        elif doc_type_raw in ["lab_report", "blood_test", "laboratory_report"]:
            try:
                cls.clean_clinical_entities(doc_id, user_id)
                l_data = LabReportData.model_validate(verified_structured_data)
                cls.save_lab_report_entities(doc_id, user_id, l_data)
            except Exception as e:
                logger.debug("Clinician verify lab report projection sync notice: %s", str(e))

        return res.data[0] if res.data else {}

    @classmethod
    def clean_clinical_entities(cls, doc_id: str, user_id: str) -> None:
        """Removes extracted prescriptions, lab reports, and document chunks for a document."""
        if is_direct_db_configured():
            try:
                with get_rls_connection(user_id=user_id, role="service_role") as conn:
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM public.extracted_medications WHERE document_id = %s;", (doc_id,))
                        cur.execute("DELETE FROM public.extracted_prescriptions WHERE document_id = %s;", (doc_id,))
                        cur.execute("DELETE FROM public.extracted_lab_results WHERE document_id = %s;", (doc_id,))
                        cur.execute("DELETE FROM public.extracted_lab_reports WHERE document_id = %s;", (doc_id,))
                        cur.execute("DELETE FROM public.document_chunks WHERE document_id = %s;", (doc_id,))
            except Exception:
                pass
            return

        if not is_supabase_configured():
            return
        client = get_supabase_admin_client()
        try:
            client.table("extracted_medications").delete().eq("document_id", doc_id).eq("user_id", user_id).execute()
        except Exception:
            pass
        try:
            client.table("extracted_prescriptions").delete().eq("document_id", doc_id).eq("user_id", user_id).execute()
        except Exception:
            pass
        try:
            client.table("extracted_lab_results").delete().eq("document_id", doc_id).eq("user_id", user_id).execute()
        except Exception:
            pass
        try:
            client.table("extracted_lab_reports").delete().eq("document_id", doc_id).eq("user_id", user_id).execute()
        except Exception:
            pass
        try:
            client.table("document_chunks").delete().eq("document_id", doc_id).eq("user_id", user_id).execute()
        except Exception:
            pass

    @classmethod
    def delete_document(cls, doc_id: str, user_id: str) -> None:
        """Deletes a document and its cascading entities after verifying ownership."""
        if is_direct_db_configured():
            # Enforce ownership check
            cls.get_document_record(doc_id, user_id)
            with get_rls_connection(user_id=user_id, role="authenticated") as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM public.medical_documents WHERE id = %s AND user_id = %s;",
                        (doc_id, user_id),
                    )
            return

        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        # Enforce ownership check
        cls.get_document_record(doc_id, user_id)

        client = get_supabase_admin_client()
        client.table("medical_documents").delete().eq("id", doc_id).execute()

    @classmethod
    def create_share(
        cls,
        doc_id: str,
        owner_id: str,
        shared_with_email: str,
        permission: str = "read",
        expires_in_days: int = 7,
    ) -> Dict[str, Any]:
        """Creates a secure document sharing authorization."""
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        cls.get_document_record(doc_id, owner_id)
        client = get_supabase_admin_client()

        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        payload = {
            "document_id": doc_id,
            "owner_id": owner_id,
            "shared_with_email": shared_with_email.lower(),
            "permission": permission,
            "expires_at": expires_at.isoformat(),
            "is_revoked": False,
        }
        res = client.table("document_shares").insert(payload).execute()
        return res.data[0]

    @classmethod
    def revoke_share(cls, share_id: str, owner_id: str) -> None:
        """Revokes a document sharing authorization."""
        if not is_supabase_configured():
            raise SupabaseNotConfiguredException()

        client = get_supabase_admin_client()
        res = client.table("document_shares").select("*").eq("id", share_id).execute()
        if not res.data:
            raise EntityNotFoundException("Document Share", share_id)
        if res.data[0]["owner_id"] != owner_id:
            raise ForbiddenException("You cannot revoke a share you do not own.")

        client.table("document_shares").update({"is_revoked": True}).eq("id", share_id).execute()
