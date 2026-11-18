import base64
import io
import json
import logging
import re
import threading
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import qrcode
import pymupdf

from backend.app.core.config import settings
from backend.app.core.exceptions import (
    EntityNotFoundException,
    ForbiddenException,
    UnauthorizedException,
    ValidationException,
)
from backend.app.core.supabase_client import get_supabase_admin_client, is_supabase_configured
from backend.app.schemas.intelligence import (
    AnalyteDataPoint,
    AnalyteTrendSeries,
    CreateShareTokenRequest,
    DoctorSummaryPreviewResponse,
    DoctorSummaryRequest,
    EmergencyCardResponse,
    EmergencyCardUpdate,
    FamilyProfileCreate,
    FamilyProfileResponse,
    HealthTrendsResponse,
    PreVisitBriefingRequest,
    PreVisitBriefingResponse,
    PublicShareAccessResponse,
    PublicSharedDocumentView,
    ShareTokenResponse,
    TimelineEvent,
    TimelineResponse,
)
from backend.app.services.audit_service import AuditService, AuditAction
from backend.app.services.auth_service import AuthService
from backend.app.services.document_service import DocumentService
from backend.app.utils.file_security import ensure_upload_dir

logger = logging.getLogger("healthsync.intelligence")


class IntelligenceService:
    """
    Advanced Health Intelligence service powering unified timeline,
    longitudinal biomarker trends, PDF summary generation, secure QR sharing,
    emergency health cards, family member profiles, and doctor pre-visit briefings.
    """

    _lock = threading.RLock()
    _data_file = ensure_upload_dir() / "advanced_intelligence.json"

    SAFETY_DISCLAIMER = (
        "HealthSync AI organizes, aggregates, and visualizes patient medical documentation. "
        "It NEVER diagnoses diseases, prescribes medicines, or alters prescribed treatments. "
        "Always consult a licensed medical physician for clinical interpretation and healthcare decisions."
    )

    @classmethod
    def _load_data(cls) -> Dict[str, Any]:
        """Loads data store with local fallback."""
        if not cls._data_file.exists():
            return {
                "shares": {},
                "emergency_cards": {},
                "family_profiles": {},
            }
        try:
            with open(cls._data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"shares": {}, "emergency_cards": {}, "family_profiles": {}}

    @classmethod
    def _save_data(cls, data: Dict[str, Any]) -> None:
        """Persists data to local store."""
        with cls._lock:
            with open(cls._data_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)

    @classmethod
    def _generate_qr_data_url(cls, text: str) -> str:
        """Generates a high-contrast QR code as a base64 PNG data URL."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=6,
            border=2,
        )
        qr.add_data(text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

    # =========================================================================
    # 1. UNIFIED MEDICAL TIMELINE
    # =========================================================================

    @classmethod
    def get_timeline(
        cls,
        user_id: str,
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        search: Optional[str] = None,
    ) -> TimelineResponse:
        """
        Aggregates all stored medical records into a chronological timeline.
        Extracts doctor, facility, date, summary, and key clinical elements.
        """
        docs = DocumentService.list_user_documents(user_id)
        events: List[TimelineEvent] = []

        for d in docs:
            # Strictly filter out non-medical documents and unsupported/failed items from clinical timeline
            if d.document_type.value == "non_medical" or d.status.value in ("unsupported", "failed"):
                continue

            rec = DocumentService.get_document_record(d.document_id, user_id)
            doc_type = d.document_type.value
            ext = rec.get("extraction_result", {})
            structured = ext.get("structured_data", {}) if isinstance(ext, dict) else {}

            # Determine best clinical event date
            event_d = d.created_at.strftime("%Y-%m-%d")
            doctor_or_facility = None
            summary = f"Uploaded {doc_type.replace('_', ' ')}: {d.original_filename}"
            key_items: List[str] = []

            if doc_type == "prescription":
                if structured.get("prescription_date"):
                    event_d = structured["prescription_date"]
                doctor_or_facility = structured.get("doctor_name") or structured.get("clinic_name")
                meds = structured.get("medications", [])
                if isinstance(meds, list):
                    key_items = [f"{m.get('name', 'Rx')} ({m.get('dosage', '')})" for m in meds[:4]]
                summary = f"Prescription by {doctor_or_facility or 'Physician'} with {len(key_items)} medication(s)"

            elif doc_type in ("blood_test", "laboratory_report"):
                if structured.get("test_date"):
                    event_d = structured["test_date"]
                doctor_or_facility = structured.get("lab_name") or structured.get("referring_doctor")
                results = structured.get("results", [])
                if isinstance(results, list):
                    key_items = [f"{r.get('test_name')}: {r.get('value')} {r.get('unit', '')}" for r in results[:4]]
                summary = f"Diagnostic report from {doctor_or_facility or 'Laboratory'} with {len(results)} biomarker(s)"

            elif doc_type == "imaging_report":
                if structured.get("report_date"):
                    event_d = structured["report_date"]
                doctor_or_facility = structured.get("imaging_center_or_hospital") or structured.get("radiologist_name")
                summary = f"Imaging scan ({structured.get('modality', 'Radiology')}) of {structured.get('body_part_or_region', 'region')}"
                if structured.get("impression"):
                    key_items.append(structured["impression"][:120])

            # Apply filters
            if category and category.lower() != "all" and doc_type != category.lower():
                continue

            if search:
                term = search.lower()
                matches_search = (
                    term in d.original_filename.lower()
                    or term in doc_type.lower()
                    or term in summary.lower()
                    or any(term in k.lower() for k in key_items)
                )
                if not matches_search:
                    continue

            raw_conf = rec.get("ocr_confidence")
            if raw_conf is None and isinstance(ext, dict):
                c = ext.get("confidence")
                if isinstance(c, dict):
                    raw_conf = c.get("overall_confidence")
                elif isinstance(c, (int, float)):
                    raw_conf = float(c)

            events.append(
                TimelineEvent(
                    id=f"timeline-{d.document_id}",
                    document_id=d.document_id,
                    event_date=str(event_d),
                    title=d.original_filename,
                    document_type=doc_type,
                    facility_or_doctor=doctor_or_facility,
                    summary=summary,
                    key_items=key_items,
                    confidence=raw_conf,
                    needs_review=rec.get("needs_human_review", False),
                    created_at=d.created_at.isoformat(),
                )
            )

        # Sort chronologically (newest first)
        events.sort(key=lambda x: x.event_date, reverse=True)
        return TimelineResponse(total=len(events), events=events)

    # =========================================================================
    # 2. HEALTH TREND ANALYTICS
    # =========================================================================

    @classmethod
    def get_health_trends(
        cls,
        user_id: str,
        biomarker_filter: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> HealthTrendsResponse:
        """
        Aggregates numerical lab results across time.
        Strictly groups by (test_name, unit) to ensure incompatible units are never compared.
        """
        docs = DocumentService.list_user_documents(user_id)
        # Map of (clean_name, unit) -> List of AnalyteDataPoint
        series_map: Dict[Tuple[str, str], List[AnalyteDataPoint]] = {}
        all_dates = []

        for d in docs:
            # Strictly filter out non-medical documents and unsupported/failed items from clinical timeline
            if d.document_type.value == "non_medical" or d.status.value in ("unsupported", "failed"):
                continue

            rec = DocumentService.get_document_record(d.document_id, user_id)
            ext = rec.get("extraction_result", {})
            structured = ext.get("structured_data", {}) if isinstance(ext, dict) else {}
            results = structured.get("results", [])

            if not isinstance(results, list):
                continue

            test_date_str = structured.get("test_date") or d.created_at.strftime("%Y-%m-%d")

            for r in results:
                name = r.get("test_name", "").strip()
                val_raw = str(r.get("value", "")).strip()
                unit = (r.get("unit") or "units").strip()
                ref_range = r.get("reference_range")
                flag = r.get("flag", "NORMAL")

                # Parse float value
                try:
                    # Strip symbols like '<', '>', '~'
                    val_clean = re.sub(r"[^\d\.]", "", val_raw)
                    val = float(val_clean)
                except Exception:
                    continue

                if biomarker_filter and biomarker_filter.lower() not in name.lower():
                    continue

                key = (name, unit)
                if key not in series_map:
                    series_map[key] = []

                dp = AnalyteDataPoint(
                    date=test_date_str,
                    value=val,
                    unit=unit,
                    reference_range=ref_range,
                    flag=flag,
                    document_id=d.document_id,
                    filename=d.original_filename,
                )
                series_map[key].append(dp)
                all_dates.append(test_date_str)

        # Assemble trend series
        series_list: List[AnalyteTrendSeries] = []
        for (name, unit), points in series_map.items():
            # Sort points by date
            points.sort(key=lambda p: p.date)
            ref = points[-1].reference_range if points else None
            series_list.append(
                AnalyteTrendSeries(
                    test_name=name,
                    unit=unit,
                    reference_range=ref,
                    points=points,
                )
            )

        series_list.sort(key=lambda s: len(s.points), reverse=True)
        return HealthTrendsResponse(
            total_biomarkers=len(series_list),
            series=series_list,
            date_range_start=min(all_dates) if all_dates else None,
            date_range_end=max(all_dates) if all_dates else None,
            disclaimer=cls.SAFETY_DISCLAIMER,
        )

    # =========================================================================
    # 3. DOCTOR VISIT SUMMARY & PDF GENERATOR
    # =========================================================================

    @classmethod
    def generate_doctor_summary_preview(
        cls, user_id: str, req: DoctorSummaryRequest
    ) -> DoctorSummaryPreviewResponse:
        """Gathers patient-controlled clinical summary distinguishing active vs past medications."""
        patient_name = "Patient"
        if is_supabase_configured():
            try:
                admin_client = get_supabase_admin_client()
                res = admin_client.table("profiles").select("full_name, email").eq("id", user_id).execute()
                if res.data:
                    patient_name = res.data[0].get("full_name") or res.data[0].get("email", "Patient").split("@")[0]
            except Exception:
                pass

        docs = DocumentService.list_user_documents(user_id)

        if req.selected_document_ids:
            sel_set = set(req.selected_document_ids)
            docs = [d for d in docs if d.document_id in sel_set]

        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        active_meds: List[Dict[str, Any]] = []
        previous_meds: List[Dict[str, Any]] = []
        recent_labs: List[Dict[str, Any]] = []
        consultations: List[Dict[str, Any]] = []
        doc_refs: List[Dict[str, str]] = []

        seen_meds = set()

        for d in docs:
            # Strictly filter out non-medical documents and unsupported/failed items from clinical timeline
            if d.document_type.value == "non_medical" or d.status.value in ("unsupported", "failed"):
                continue

            rec = DocumentService.get_document_record(d.document_id, user_id)
            doc_type = d.document_type.value
            ext = rec.get("extraction_result", {})
            structured = ext.get("structured_data", {}) if isinstance(ext, dict) else {}
            created_at = d.created_at

            doc_refs.append({
                "document_id": d.document_id,
                "filename": d.original_filename,
                "type": doc_type,
                "date": created_at.strftime("%Y-%m-%d"),
            })

            # Process medications
            if doc_type == "prescription":
                meds = structured.get("medications", [])
                doctor = structured.get("doctor_name") or "Prescribing Physician"
                rx_date = structured.get("prescription_date") or created_at.strftime("%Y-%m-%d")
                is_recent = created_at >= thirty_days_ago

                if isinstance(meds, list):
                    for m in meds:
                        name = m.get("name", "Medication")
                        if name in seen_meds:
                            continue
                        seen_meds.add(name)
                        entry = {
                            "name": name,
                            "dosage": m.get("dosage", "N/A"),
                            "frequency": m.get("frequency", "N/A"),
                            "prescribed_by": doctor,
                            "date": rx_date,
                            "source_doc": d.original_filename,
                        }
                        if is_recent:
                            active_meds.append(entry)
                        else:
                            previous_meds.append(entry)

            # Process labs
            elif doc_type in ("blood_test", "laboratory_report"):
                lab_name = structured.get("lab_name") or "Laboratory"
                results = structured.get("results", [])
                if isinstance(results, list):
                    for r in results[:6]:
                        recent_labs.append({
                            "test_name": r.get("test_name"),
                            "value": r.get("value"),
                            "unit": r.get("unit"),
                            "reference_range": r.get("reference_range"),
                            "flag": r.get("flag", "NORMAL"),
                            "lab": lab_name,
                            "date": structured.get("test_date") or created_at.strftime("%Y-%m-%d"),
                            "source_doc": d.original_filename,
                        })

            # Consultations / summaries
            elif doc_type in ("consultation_record", "discharge_summary", "imaging_report"):
                consultations.append({
                    "title": d.original_filename,
                    "type": doc_type.replace("_", " ").title(),
                    "date": created_at.strftime("%Y-%m-%d"),
                    "summary": f"Clinical document: {d.original_filename}",
                })

        return DoctorSummaryPreviewResponse(
            patient_name=patient_name,
            generated_at=now.strftime("%d %B %Y, %H:%M UTC"),
            specialty=req.visit_specialty,
            active_medications=active_meds,
            previous_medications=previous_meds,
            recent_labs=recent_labs[:10],
            consultations=consultations[:5],
            document_references=doc_refs,
            disclaimer=cls.SAFETY_DISCLAIMER,
        )

    @classmethod
    def generate_doctor_summary_pdf(cls, user_id: str, req: DoctorSummaryRequest) -> bytes:
        """
        Renders a clean clinical PDF summary using PyMuPDF.
        Returns genuine PDF bytes starting with %PDF-.
        """
        summary = cls.generate_doctor_summary_preview(user_id, req)
        doc = pymupdf.open()
        page = doc.new_page(width=595, height=842)  # A4 size

        # Header bar
        header_rect = pymupdf.Rect(40, 40, 555, 95)
        page.draw_rect(header_rect, color=None, fill=(0.06, 0.45, 0.72))  # Health blue
        page.insert_text(pymupdf.Point(55, 68), "HEALTHSYNC AI — PATIENT MEDICAL SUMMARY", fontsize=14, color=(1, 1, 1), fontname="helv")
        page.insert_text(pymupdf.Point(55, 84), "Patient-Controlled Clinical History Briefing", fontsize=10, color=(0.85, 0.95, 1), fontname="helv")

        # Patient Info Card
        y = 120
        page.insert_text(pymupdf.Point(40, y), f"Patient Name: {summary.patient_name}", fontsize=11, fontname="helv", color=(0.06, 0.09, 0.16))
        page.insert_text(pymupdf.Point(340, y), f"Generated: {summary.generated_at}", fontsize=9, fontname="helv", color=(0.3, 0.35, 0.4))
        y += 18
        if summary.specialty:
            page.insert_text(pymupdf.Point(40, y), f"Target Specialty: {summary.specialty}", fontsize=10, fontname="helv", color=(0.1, 0.4, 0.6))
            y += 18

        page.draw_line(pymupdf.Point(40, y), pymupdf.Point(555, y), color=(0.85, 0.9, 0.95), width=1)
        y += 20

        # Section: Current Active Medications
        page.insert_text(pymupdf.Point(40, y), "CURRENT RECORDED MEDICATIONS (Last 30 Days)", fontsize=11, fontname="helv", color=(0.06, 0.45, 0.72))
        y += 16
        if not summary.active_medications:
            page.insert_text(pymupdf.Point(45, y), "• No active medications recorded in the last 30 days.", fontsize=9, fontname="helv", color=(0.4, 0.45, 0.5))
            y += 16
        else:
            for m in summary.active_medications[:5]:
                med_line = f"• {m['name']} {m['dosage']} — {m['frequency']} (Prescribed: {m['date']}, {m['prescribed_by']})"
                page.insert_text(pymupdf.Point(45, y), med_line[:95], fontsize=9, fontname="helv", color=(0.1, 0.1, 0.1))
                y += 15

        y += 10
        # Section: Previously Recorded Medications
        if summary.previous_medications:
            page.insert_text(pymupdf.Point(40, y), "HISTORICAL / PREVIOUS MEDICATIONS", fontsize=10, fontname="helv", color=(0.3, 0.35, 0.4))
            y += 15
            for m in summary.previous_medications[:3]:
                med_line = f"• {m['name']} {m['dosage']} — Prescribed: {m['date']}"
                page.insert_text(pymupdf.Point(45, y), med_line[:95], fontsize=9, fontname="helv", color=(0.4, 0.45, 0.5))
                y += 14
            y += 10

        # Section: Recent Laboratory Biomarkers
        page.insert_text(pymupdf.Point(40, y), "RECENT LABORATORY & DIAGNOSTIC FINDINGS", fontsize=11, fontname="helv", color=(0.06, 0.45, 0.72))
        y += 16
        if not summary.recent_labs:
            page.insert_text(pymupdf.Point(45, y), "• No recent laboratory investigations recorded.", fontsize=9, fontname="helv", color=(0.4, 0.45, 0.5))
            y += 16
        else:
            for l in summary.recent_labs[:6]:
                flag_str = f" [{l['flag']}]" if l.get("flag") and l["flag"] != "NORMAL" else ""
                lab_line = f"• {l['test_name']}: {l['value']} {l.get('unit', '')} (Ref: {l.get('reference_range', 'N/A')}){flag_str} — {l['date']}"
                flag_color = (0.8, 0.1, 0.2) if flag_str else (0.1, 0.1, 0.1)
                page.insert_text(pymupdf.Point(45, y), lab_line[:95], fontsize=9, fontname="helv", color=flag_color)
                y += 15

        y += 10
        # Section: Document References
        page.insert_text(pymupdf.Point(40, y), f"INDEXED SOURCE DOCUMENTS ({len(summary.document_references)})", fontsize=10, fontname="helv", color=(0.3, 0.35, 0.4))
        y += 15
        for ref in summary.document_references[:4]:
            ref_line = f"• [{ref['type'].upper()}] {ref['filename']} ({ref['date']})"
            page.insert_text(pymupdf.Point(45, y), ref_line[:90], fontsize=8, fontname="helv", color=(0.45, 0.5, 0.55))
            y += 13

        # Footer Medical Disclaimer
        footer_rect = pymupdf.Rect(40, 770, 555, 810)
        page.draw_rect(footer_rect, color=None, fill=(0.96, 0.97, 0.98))
        disclaimer_text = (
            "NOTICE: This document organizes patient-supplied records for clinical reference only. "
            "It NEVER diagnoses diseases, prescribes medicines, or recommends changes to prescribed treatments."
        )
        page.insert_text(pymupdf.Point(50, 792), disclaimer_text, fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.5))

        pdf_bytes = doc.tobytes()
        doc.close()

        AuditService.log_event(
            action=AuditAction.DOCUMENT_REVIEW,
            resource_type="doctor_summary_pdf",
            user_id=user_id,
            metadata={"specialty": req.visit_specialty},
        )
        return pdf_bytes

    # =========================================================================
    # 4. SECURE QR CODE & DOCUMENT SHARING
    # =========================================================================

    @classmethod
    def create_share_token(
        cls, user_id: str, req: CreateShareTokenRequest
    ) -> ShareTokenResponse:
        """
        Creates an unpredictable, time-limited read-only sharing token with a QR code.
        Never exposes raw permanent storage URLs.
        """
        # Validate that all document_ids belong to the user
        user_docs = DocumentService.list_user_documents(user_id)
        user_doc_ids = {d.document_id for d in user_docs}
        for did in req.document_ids:
            if did not in user_doc_ids:
                raise ForbiddenException(f"Document {did} does not belong to your account.")

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=req.expires_in_hours)
        share_token = f"hst_{uuid.uuid4().hex}"

        share_url = f"{settings.API_V1_STR}/shares/public/{share_token}"
        full_public_url = f"http://localhost:3000/shared/{share_token}"

        # Generate QR code pointing to public share view
        qr_data_url = cls._generate_qr_data_url(full_public_url)

        share_record = {
            "share_token": share_token,
            "user_id": user_id,
            "document_ids": req.document_ids,
            "recipient_label": req.recipient_label,
            "permission_level": "READ_ONLY",
            "expires_at": expires_at.isoformat(),
            "is_revoked": False,
            "view_count": 0,
            "last_accessed_at": None,
            "created_at": now.isoformat(),
        }

        with cls._lock:
            data = cls._load_data()
            data["shares"][share_token] = share_record
            cls._save_data(data)

        AuditService.log_event(
            action=AuditAction.SHARE_CREATE,
            resource_type="share_token",
            resource_id=share_token,
            user_id=user_id,
            metadata={"doc_count": len(req.document_ids), "expires_hours": req.expires_in_hours},
        )

        return ShareTokenResponse(
            share_token=share_token,
            share_url=full_public_url,
            qr_code_data_url=qr_data_url,
            recipient_label=req.recipient_label,
            expires_at=expires_at.isoformat(),
            document_count=len(req.document_ids),
            is_revoked=False,
            created_at=now.isoformat(),
        )

    @classmethod
    def get_public_share(cls, share_token: str) -> PublicShareAccessResponse:
        """
        Retrieves shared document summaries via valid, non-expired token.
        Increments view count and updates audit trail.
        """
        data = cls._load_data()
        share = data["shares"].get(share_token)
        if not share:
            raise EntityNotFoundException("Shared record", share_token)

        if share.get("is_revoked"):
            raise ForbiddenException("This temporary sharing link has been revoked by the patient.")

        # Check expiration
        expires_at = datetime.fromisoformat(share["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            raise ForbiddenException("This temporary sharing link has expired.")

        # Increment view count
        now = datetime.now(timezone.utc)
        share["view_count"] = share.get("view_count", 0) + 1
        share["last_accessed_at"] = now.isoformat()

        with cls._lock:
            data["shares"][share_token] = share
            cls._save_data(data)

        # Build public views of the permitted documents
        owner_id = share["user_id"]
        doc_views: List[PublicSharedDocumentView] = []

        for did in share["document_ids"]:
            try:
                rec = DocumentService.get_document_record(did, owner_id)
                ext = rec.get("extraction_result", {})
                structured = ext.get("structured_data") if isinstance(ext, dict) else None

                doc_views.append(
                    PublicSharedDocumentView(
                        document_id=did,
                        filename=rec["original_filename"],
                        document_type=rec.get("document_type", "other"),
                        date=str(rec.get("created_at"))[:10],
                        summary=f"Verified clinical record: {rec['original_filename']}",
                        extracted_data=structured,
                    )
                )
            except Exception:
                continue

        return PublicShareAccessResponse(
            share_token=share_token,
            recipient_label=share.get("recipient_label"),
            expires_at=share["expires_at"],
            documents=doc_views,
            disclaimer=cls.SAFETY_DISCLAIMER,
        )

    @classmethod
    def list_user_shares(cls, user_id: str) -> List[ShareTokenResponse]:
        """Lists active and historical share links created by the user."""
        data = cls._load_data()
        user_shares = [
            ShareTokenResponse(
                share_token=s["share_token"],
                share_url=f"http://localhost:3000/shared/{s['share_token']}",
                qr_code_data_url=cls._generate_qr_data_url(f"http://localhost:3000/shared/{s['share_token']}"),
                recipient_label=s.get("recipient_label"),
                expires_at=s["expires_at"],
                document_count=len(s.get("document_ids", [])),
                is_revoked=s.get("is_revoked", False),
                created_at=s["created_at"],
            )
            for s in data["shares"].values()
            if s.get("user_id") == user_id
        ]
        return sorted(user_shares, key=lambda x: x.created_at, reverse=True)

    @classmethod
    def revoke_share_token(cls, user_id: str, share_token: str) -> None:
        """Revokes a share token immediately."""
        data = cls._load_data()
        share = data["shares"].get(share_token)
        if not share:
            raise EntityNotFoundException("Share token", share_token)
        if share.get("user_id") != user_id:
            raise ForbiddenException("Cannot revoke another user's share token.")

        share["is_revoked"] = True
        with cls._lock:
            data["shares"][share_token] = share
            cls._save_data(data)

        AuditService.log_event(
            action=AuditAction.SHARE_REVOKE,
            resource_type="share_token",
            resource_id=share_token,
            user_id=user_id,
        )

    # =========================================================================
    # 5. EMERGENCY HEALTH CARD
    # =========================================================================

    @classmethod
    def get_or_create_emergency_card(cls, user_id: str) -> EmergencyCardResponse:
        """Retrieves or provisions the patient's emergency card."""
        data = cls._load_data()
        card = data["emergency_cards"].get(user_id)

        now = datetime.now(timezone.utc)

        # Check Supabase if configured and not found locally
        if not card and is_supabase_configured():
            try:
                admin_client = get_supabase_admin_client()
                res = admin_client.table("emergency_cards").select("*").eq("user_id", user_id).execute()
                if res.data:
                    card = res.data[0]
                    with cls._lock:
                        data["emergency_cards"][user_id] = card
                        cls._save_data(data)
            except Exception as e:
                logger.warning("Supabase emergency card fetch warning: %s", str(e))

        if not card:
            emergency_token = f"emg_{uuid.uuid4().hex}"
            card = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "emergency_token": emergency_token,
                "emergency_contact_name": None,
                "emergency_contact_phone": None,
                "emergency_contact_relation": None,
                "allergies": [],
                "confirmed_medications": [],
                "blood_group": None,
                "critical_notes": None,
                "is_active": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            with cls._lock:
                data["emergency_cards"][user_id] = card
                cls._save_data(data)

            if is_supabase_configured():
                try:
                    admin_client = get_supabase_admin_client()
                    admin_client.table("emergency_cards").insert(card).execute()
                except Exception as e:
                    logger.warning("Supabase emergency card insert warning: %s", str(e))

        public_url = f"http://localhost:3000/emergency/{card['emergency_token']}"
        qr_url = cls._generate_qr_data_url(public_url)

        return EmergencyCardResponse(
            id=card["id"],
            user_id=card["user_id"],
            emergency_token=card["emergency_token"],
            emergency_url=public_url,
            qr_code_data_url=qr_url,
            emergency_contact_name=card.get("emergency_contact_name"),
            emergency_contact_phone=card.get("emergency_contact_phone"),
            emergency_contact_relation=card.get("emergency_contact_relation"),
            allergies=card.get("allergies", []),
            confirmed_medications=card.get("confirmed_medications", []),
            blood_group=card.get("blood_group"),
            critical_notes=card.get("critical_notes"),
            is_active=card.get("is_active", True),
            updated_at=card.get("updated_at", now.isoformat()),
            disclaimer=cls.SAFETY_DISCLAIMER,
        )

    @classmethod
    def update_emergency_card(
        cls, user_id: str, req: EmergencyCardUpdate
    ) -> EmergencyCardResponse:
        """Updates patient's emergency health card info."""
        data = cls._load_data()
        cls.get_or_create_emergency_card(user_id)  # ensure exists
        card = data["emergency_cards"][user_id]

        now = datetime.now(timezone.utc)
        card["emergency_contact_name"] = req.emergency_contact_name
        card["emergency_contact_phone"] = req.emergency_contact_phone
        card["emergency_contact_relation"] = req.emergency_contact_relation
        card["allergies"] = req.allergies
        card["confirmed_medications"] = req.confirmed_medications
        card["blood_group"] = req.blood_group
        card["critical_notes"] = req.critical_notes
        card["is_active"] = req.is_active
        card["updated_at"] = now.isoformat()

        with cls._lock:
            data["emergency_cards"][user_id] = card
            cls._save_data(data)

        if is_supabase_configured():
            try:
                admin_client = get_supabase_admin_client()
                admin_client.table("emergency_cards").upsert(card).execute()
            except Exception as e:
                logger.warning("Supabase emergency card update warning: %s", str(e))

        return cls.get_or_create_emergency_card(user_id)

    @classmethod
    def rotate_emergency_token(cls, user_id: str) -> EmergencyCardResponse:
        """Rotates the emergency token to immediately invalidate previously shared QR codes."""
        data = cls._load_data()
        cls.get_or_create_emergency_card(user_id)
        card = data["emergency_cards"][user_id]
        new_token = f"emg_{uuid.uuid4().hex}"
        card["emergency_token"] = new_token
        card["updated_at"] = datetime.now(timezone.utc).isoformat()

        with cls._lock:
            data["emergency_cards"][user_id] = card
            cls._save_data(data)

        if is_supabase_configured():
            try:
                admin_client = get_supabase_admin_client()
                admin_client.table("emergency_cards").update({
                    "emergency_token": new_token,
                    "updated_at": card["updated_at"],
                }).eq("user_id", user_id).execute()
            except Exception as e:
                logger.warning("Supabase emergency token rotation warning: %s", str(e))

        return cls.get_or_create_emergency_card(user_id)

    @classmethod
    def get_public_emergency_card(cls, emergency_token: str) -> EmergencyCardResponse:
        """Retrieves emergency info for first responders via active token."""
        data = cls._load_data()
        target_card = None
        for c in data["emergency_cards"].values():
            if c.get("emergency_token") == emergency_token:
                target_card = c
                break

        if not target_card and is_supabase_configured():
            try:
                admin_client = get_supabase_admin_client()
                res = admin_client.table("emergency_cards").select("*").eq("emergency_token", emergency_token).eq("is_active", True).execute()
                if res.data:
                    target_card = res.data[0]
            except Exception as e:
                logger.warning("Supabase public emergency card lookup warning: %s", str(e))

        if not target_card or not target_card.get("is_active", True):
            raise EntityNotFoundException("Emergency Health Card", emergency_token)

        public_url = f"http://localhost:3000/emergency/{emergency_token}"
        qr_url = cls._generate_qr_data_url(public_url)

        return EmergencyCardResponse(
            id=target_card["id"],
            user_id="protected",
            emergency_token=emergency_token,
            emergency_url=public_url,
            qr_code_data_url=qr_url,
            emergency_contact_name=target_card.get("emergency_contact_name"),
            emergency_contact_phone=target_card.get("emergency_contact_phone"),
            emergency_contact_relation=target_card.get("emergency_contact_relation"),
            allergies=target_card.get("allergies", []),
            confirmed_medications=target_card.get("confirmed_medications", []),
            blood_group=target_card.get("blood_group"),
            critical_notes=target_card.get("critical_notes"),
            is_active=target_card.get("is_active", True),
            updated_at=target_card.get("updated_at", ""),
            disclaimer=cls.SAFETY_DISCLAIMER,
        )

    # =========================================================================
    # 6. FAMILY PROFILES
    # =========================================================================

    @classmethod
    def create_family_profile(
        cls, account_owner_id: str, req: FamilyProfileCreate
    ) -> FamilyProfileResponse:
        """Creates a separate profile for a family member."""
        if not req.full_name.strip():
            raise ValidationException("Family member full name cannot be empty.")

        profile_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        profile_data = {
            "id": profile_id,
            "account_owner_id": account_owner_id,
            "full_name": req.full_name.strip(),
            "relationship": req.relationship,
            "date_of_birth": req.date_of_birth.isoformat() if req.date_of_birth else None,
            "gender": req.gender,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        with cls._lock:
            data = cls._load_data()
            data["family_profiles"][profile_id] = profile_data
            cls._save_data(data)

        AuditService.log_event(
            action=AuditAction.USER_REGISTER,
            resource_type="family_profile",
            resource_id=profile_id,
            user_id=account_owner_id,
            metadata={"relationship": req.relationship},
        )

        return FamilyProfileResponse(
            id=profile_id,
            account_owner_id=account_owner_id,
            full_name=profile_data["full_name"],
            relationship=profile_data["relationship"],
            date_of_birth=profile_data["date_of_birth"],
            gender=profile_data["gender"],
            created_at=profile_data["created_at"],
        )

    @classmethod
    def list_family_profiles(cls, account_owner_id: str) -> List[FamilyProfileResponse]:
        """Lists family profiles belonging to the account owner."""
        data = cls._load_data()
        profiles = [
            FamilyProfileResponse(
                id=p["id"],
                account_owner_id=p["account_owner_id"],
                full_name=p["full_name"],
                relationship=p["relationship"],
                date_of_birth=p.get("date_of_birth"),
                gender=p.get("gender"),
                created_at=str(p["created_at"]),
            )
            for p in data["family_profiles"].values()
            if p.get("account_owner_id") == account_owner_id
        ]
        return sorted(profiles, key=lambda x: x.created_at)

    @classmethod
    def delete_family_profile(cls, account_owner_id: str, profile_id: str) -> None:
        """Deletes a family profile after verifying ownership."""
        data = cls._load_data()
        p = data["family_profiles"].get(profile_id)
        if not p:
            raise EntityNotFoundException("Family profile", profile_id)
        if p.get("account_owner_id") != account_owner_id:
            raise ForbiddenException("Access to family profile denied.")

        with cls._lock:
            del data["family_profiles"][profile_id]
            cls._save_data(data)

    # =========================================================================
    # 7. PRE-VISIT DOCTOR BRIEFING
    # =========================================================================

    @classmethod
    def generate_pre_visit_briefing(
        cls, user_id: str, req: PreVisitBriefingRequest
    ) -> PreVisitBriefingResponse:
        """
        Creates a structured pre-visit briefing with relevant timeline events,
        active medicines, lab readings, and neutral suggested questions for the physician.
        """
        summary_req = DoctorSummaryRequest(
            selected_document_ids=req.selected_document_ids,
            visit_specialty=req.doctor_specialty,
        )
        summary = cls.generate_doctor_summary_preview(user_id, summary_req)

        recent_events = [f"Record on {d['date']}: {d['filename']}" for d in summary.document_references[:4]]
        active_meds = [f"{m['name']} ({m['dosage']}) - {m['frequency']}" for m in summary.active_medications[:5]]
        lab_trends = [f"{l['test_name']}: {l['value']} {l.get('unit', '')}" for l in summary.recent_labs[:5]]

        # Neutral prompts based on actual recorded items
        suggested_questions: List[str] = [
            f"Discuss current primary reason for consultation: '{req.primary_concern}'.",
        ]

        if active_meds:
            suggested_questions.append(
                f"Review continuation or adjustment of current medications: {', '.join(m['name'] for m in summary.active_medications[:3])}."
            )

        abnormal_labs = [l for l in summary.recent_labs if l.get("flag") and l["flag"] != "NORMAL"]
        if abnormal_labs:
            abn_names = ", ".join(l["test_name"] for l in abnormal_labs[:2])
            suggested_questions.append(
                f"Discuss recent out-of-range laboratory biomarker findings ({abn_names}) and whether follow-up testing is indicated."
            )
        else:
            suggested_questions.append("Inquire whether any routine follow-up blood tests or preventive investigations are recommended.")

        suggested_questions.append("Ask about any potential drug interactions or symptoms to monitor.")

        return PreVisitBriefingResponse(
            specialty=req.doctor_specialty,
            primary_concern=req.primary_concern,
            recent_timeline=recent_events,
            active_medications=active_meds,
            relevant_lab_trends=lab_trends,
            suggested_questions_for_doctor=suggested_questions,
            disclaimer=cls.SAFETY_DISCLAIMER,
        )
