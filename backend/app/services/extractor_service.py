import re
from typing import List, Optional, Tuple
from backend.app.schemas.document import (
    DocumentType,
    MedicationItem,
    PrescriptionData,
    LabTestItem,
    LabReportData,
    ImagingReportData,
    ConsultationData,
    DischargeSummaryData,
    GenericDocumentData,
    StructuredMedicalData,
)


class ExtractorService:
    """
    Deterministic regex and heuristic parser for extracting structured medical data
    from raw OCR / PDF text. Unknown fields remain None. Never invents data.
    """

    @classmethod
    def _extract_patient_name(cls, text: str) -> Optional[str]:
        # Match only on the same line and strictly with word boundaries to avoid false positives (e.g. prescriPTion)
        match = re.search(
            r"(?i)\b(?:patient(?:\s+name)?|pt\.?(?:\s+name)?|name)\b[\t ]*[:\-]?[\t ]+([A-Za-z][a-zA-Z\.\- ]{2,30})",
            text,
        )
        if match:
            candidate = match.group(1).split("\n")[0].strip()
            # If multiple spaces, tabs, or following metadata labels appear, isolate the patient name
            candidate = re.split(r"\s{2,}|\t|\b(?:mrn|age|dob|date|sex|gender)\b", candidate, flags=re.I)[0].strip()
            # Exclude false positives like "Prescription", "Doctor", "Date", "Rx"
            if not re.search(r"prescription|doctor|date|hospital|clinic|report|\brx\b|admission|discharge|record", candidate, re.I):
                return candidate
        return None

    @classmethod
    def _extract_doctor_name(cls, text: str) -> Optional[str]:
        match = re.search(
            r"(?i)(?:dr\.|doctor|physician)[\t ]*[:\-]?[\t ]*([A-Za-z][a-zA-Z\.\- ]{2,30})",
            text,
        )
        if match:
            candidate = match.group(1).split("\n")[0].strip()
            if not re.search(r"patient|date|hospital|clinic|report|prescription|\brx\b", candidate, re.I):
                return f"Dr. {candidate}" if not candidate.lower().startswith("dr") else candidate
        return None

    @classmethod
    def _extract_date(cls, text: str) -> Optional[str]:
        match = re.search(
            r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b",
            text,
            re.IGNORECASE,
        )
        return match.group(1) if match else None

    @classmethod
    def _extract_clinic_or_hospital(cls, text: str) -> Optional[str]:
        match = re.search(
            r"([A-Za-z0-9\s\.\-]{3,40}(?:Hospital|Clinic|Medical Center|Healthcare|Dispensary|Diagnostic Center))",
            text,
            re.IGNORECASE,
        )
        return match.group(1).strip() if match else None

    # ==========================================================================
    # Prescription Parsing
    # ==========================================================================

    @classmethod
    def extract_prescription(cls, text: str) -> PrescriptionData:
        """Extracts structured prescription fields from text."""
        patient_name = cls._extract_patient_name(text)
        doctor_name = cls._extract_doctor_name(text)
        clinic = cls._extract_clinic_or_hospital(text)
        rx_date = cls._extract_date(text)

        # Explicit diagnosis written in the document
        diagnosis: Optional[str] = None
        diag_match = re.search(
            r"(?:diagnosis|dx|impression)[\s:]+([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        if diag_match:
            candidate_diag = diag_match.group(1).strip()
            if len(candidate_diag) > 2 and len(candidate_diag) < 120:
                diagnosis = candidate_diag

        # Parse medications with multiline Sig association
        medications = cls._extract_medications(text)

        return PrescriptionData(
            patient_name=patient_name,
            doctor_name=doctor_name,
            clinic_or_hospital=clinic,
            prescription_date=rx_date,
            medications=medications,
            diagnosis_text=diagnosis,
        )

    @classmethod
    def _extract_medications(cls, text: str) -> List[MedicationItem]:
        """
        Parses structured medication items from text.
        Handles multiline Sig instructions, associating following Sig/instruction lines
        with preceding medications rather than creating bogus standalone medication items.
        """
        lines = text.split("\n")
        medications: List[MedicationItem] = []
        current_med: Optional[MedicationItem] = None

        dosage_pattern = re.compile(
            r"(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|tablets?|tabs?|capsules?|caps?|puffs?|drops?|units?))\b",
            re.IGNORECASE,
        )
        freq_pattern = re.compile(
            r"\b(?:(?:(?:sos|prn)\s+)?every\s+\d+\s+hours?(?:\s+(?:prn|as\s+needed|sos))?|"
            r"(?:OD|BD|TID|QID|PRN|SOS)\s*\([^)]+\)|"
            r"(?:three|four)\s+times\s+daily|once\s+daily|twice\s+daily|thrice\s+daily|"
            r"as\s+needed|at\s+bedtime|daily|\b(?:od|bid|tid|qid|prn|sos|hs)\b)",
            re.IGNORECASE,
        )
        duration_pattern = re.compile(
            r"(?:for\s+|x\s*)(\d+\s*(?:days?|weeks?|months?))\b",
            re.IGNORECASE,
        )
        instructions_pattern = re.compile(
            r"\b(after\s+meals?|before\s+meals?|with\s+(?:morning\s+)?meals?|with\s+food|empty\s+stomach|"
            r"at\s+bedtime|before\s+bedtime|in\s+the\s+morning|for\s+fever\s*(?:\/|\bor\b)\s*pain|"
            r"for\s+pain|for\s+fever|for\s+cough)\b",
            re.IGNORECASE,
        )
        route_pattern = re.compile(
            r"\b(orally|oral|sublingually|topically|by\s+mouth|inhaled|iv|im)\b",
            re.IGNORECASE,
        )
        sig_lead_pattern = re.compile(
            r"^\s*(?:sig[\s\:\.\-]|directions?[\s\:\.\-]|instructions?[\s\:\.\-]|take\b|apply\b|instill\b|inhale\b)",
            re.IGNORECASE,
        )
        ignore_header_pattern = re.compile(
            r"^(?:rx\b|patient|doctor|dr\.|clinic|hospital|date|age|dob|sex|phone|license|signature|diagnosis|dispense\s*:|refills?\s*:)",
            re.IGNORECASE,
        )

        for line in lines:
            raw_line = line
            line_str = line.strip()
            if not line_str:
                continue

            # Ignore non-medication document headers
            if ignore_header_pattern.match(line_str) and not sig_lead_pattern.match(line_str):
                continue

            # Check if this line is a continuation instruction (e.g. "Sig: ...", indented line, or directive)
            is_sig = bool(sig_lead_pattern.match(line_str))
            is_continuation = is_sig or (
                current_med is not None
                and (raw_line.startswith("   ") or raw_line.startswith("\t"))
                and not re.search(r"^\s*(?:\d+[\.\)]|[\-\*•])\s*(?:tab|cap|syrup|syp|inj|ointment)", line_str, re.I)
            )

            if is_continuation:
                if current_med is not None:
                    clean_sig = re.sub(
                        r"^\s*(?:sig[\s\:\.\-]|directions?[\s\:\.\-]|instructions?[\s\:\.\-])\s*",
                        "",
                        line_str,
                        flags=re.I,
                    )

                    # Extract frequency if not already set on medication
                    f_m = freq_pattern.search(clean_sig)
                    if f_m and not current_med.frequency:
                        current_med.frequency = f_m.group(0).strip()

                    # Extract duration
                    d_m = duration_pattern.search(clean_sig)
                    if d_m and not current_med.duration:
                        current_med.duration = d_m.group(1).strip()

                    # Extract route and instructions
                    inst_parts = []
                    r_m = route_pattern.search(clean_sig)
                    if r_m:
                        inst_parts.append(r_m.group(1).strip())
                    i_m = instructions_pattern.search(clean_sig)
                    if i_m:
                        inst_parts.append(i_m.group(1).strip())

                    if inst_parts:
                        new_inst = " ".join(inst_parts)
                        current_med.instructions = (
                            f"{current_med.instructions}, {new_inst}" if current_med.instructions else new_inst
                        )
                    elif not current_med.instructions and clean_sig:
                        sanitized = re.sub(r"[,;:\-\–]", " ", clean_sig).strip()
                        if len(sanitized) > 2:
                            current_med.instructions = sanitized[:120].strip()

                    # If dosage was missing on medication header line, extract from Sig line
                    if not current_med.dosage:
                        dos_m = dosage_pattern.search(clean_sig)
                        if dos_m:
                            current_med.dosage = dos_m.group(1).strip()

                # Standalone Sig line or continuation must never create a separate medication item
                continue

            # Check if this line introduces a new medication
            has_dosage = dosage_pattern.search(line_str)
            has_form = re.search(
                r"\b(tab(?:let)?|cap(?:sule)?|syrup|syp|inj(?:ection)?|ointment|suspension|drops?|cream|gel|lotion|inhaler)\b",
                line_str,
                re.IGNORECASE,
            )

            if has_dosage or has_form:
                dosage = has_dosage.group(1) if has_dosage else None
                freq_match = freq_pattern.search(line_str)
                freq = freq_match.group(0) if freq_match else None
                dur_match = duration_pattern.search(line_str)
                duration = dur_match.group(1) if dur_match else None
                inst_match = instructions_pattern.search(line_str)
                instructions = inst_match.group(1) if inst_match else None
                route_match = route_pattern.search(line_str)
                route = route_match.group(1) if route_match else None

                # Clean name: remove list numbering, formulation prefix, dosage, freq, duration, instructions, route
                name_candidate = line_str
                name_candidate = re.sub(r"^\s*(?:\d+[\.\)]|[\-\*•])+\s*", "", name_candidate)
                name_candidate = re.sub(
                    r"^\s*(?:tab(?:let)?|cap(?:sule)?|syrup|syp|inj(?:ection)?|ointment|suspension|drops?|cream|gel|lotion|inhaler)\b[\.]?\s*",
                    "",
                    name_candidate,
                    flags=re.IGNORECASE,
                )
                for part in [dosage, freq, duration, instructions, route, "for"]:
                    if part:
                        name_candidate = re.sub(rf"\b{re.escape(part)}\b", "", name_candidate, flags=re.IGNORECASE)

                name_clean = re.sub(r"[,;:\-\–]", " ", name_candidate).strip()
                name_clean = re.sub(r"\s+", " ", name_clean).strip()

                # Guard against non-medication lines like "Dispense: 100ml bottle" or "Sig: 1 tab"
                if (
                    len(name_clean) > 2
                    and not re.search(r"^(?:dispense|refill|instructions?|signature|date)\b", name_clean, re.I)
                    and not sig_lead_pattern.match(name_clean)
                ):
                    # Combine route with instructions if both exist
                    final_inst = instructions
                    if route and (not instructions or route.lower() not in instructions.lower()):
                        final_inst = f"{route} {instructions}" if instructions else route

                    new_med = MedicationItem(
                        name=name_clean,
                        dosage=dosage,
                        frequency=freq,
                        duration=duration,
                        instructions=final_inst,
                    )
                    medications.append(new_med)
                    current_med = new_med

        return medications

    # ==========================================================================
    # Laboratory Report Parsing
    # ==========================================================================

    @classmethod
    def extract_lab_report(cls, text: str, category: Optional[str] = None) -> LabReportData:
        """Extracts structured laboratory test values, units, and reference ranges."""
        patient_name = cls._extract_patient_name(text)
        doctor_or_lab = cls._extract_clinic_or_hospital(text) or cls._extract_doctor_name(text)
        report_date = cls._extract_date(text)

        tests: List[LabTestItem] = []
        lines = text.split("\n")

        test_line_regex = re.compile(
            r"([A-Za-z\s\(\)\/\-\+]{3,35})\s+([\d\.]+)\s+([a-zA-Z\/\%\^]+)?\s*([\(]?[\d\.]+\s*[-–to]+\s*[\d\.]+[\)]?)?",
            re.IGNORECASE,
        )

        for line in lines:
            line_str = line.strip()
            if re.search(r"patient|name|date|doctor|hospital|age|gender|reference|page", line_str, re.I):
                continue

            match = test_line_regex.search(line_str)
            if match:
                test_name = match.group(1).strip()
                value = match.group(2).strip()
                unit = match.group(3).strip() if match.group(3) else None
                ref_range = match.group(4).strip() if match.group(4) else None

                # Check if flagged high / low in line
                is_abnormal = None
                if re.search(r"\b(high|low|critical|abnormal|\(h\)|\(l\))\b", line_str, re.I):
                    is_abnormal = True

                if len(test_name) > 2 and not test_name.isnumeric():
                    tests.append(
                        LabTestItem(
                            test_name=test_name,
                            measured_value=value,
                            unit=unit,
                            reference_range=ref_range,
                            test_category=category,
                            is_abnormal=is_abnormal,
                        )
                    )

        return LabReportData(
            patient_name=patient_name,
            doctor_or_lab_name=doctor_or_lab,
            report_date=report_date,
            test_category=category or "General Laboratory",
            tests=tests,
        )

    # ==========================================================================
    # Imaging Report Parsing
    # ==========================================================================

    @classmethod
    def extract_imaging_report(cls, text: str) -> ImagingReportData:
        """Extracts radiological / imaging findings and impressions."""
        patient_name = cls._extract_patient_name(text)
        radiologist = cls._extract_doctor_name(text)
        center = cls._extract_clinic_or_hospital(text)
        date = cls._extract_date(text)

        # Modality detection
        modality = None
        if re.search(r"\bmri\b|magnetic resonance", text, re.I):
            modality = "MRI"
        elif re.search(r"\bct\s+scan\b|computed tomography", text, re.I):
            modality = "CT Scan"
        elif re.search(r"\bx-ray\b|radiograph", text, re.I):
            modality = "X-Ray"
        elif re.search(r"\bultrasound\b|sonography|\busg\b", text, re.I):
            modality = "Ultrasound"

        # Body part
        body_part = None
        part_match = re.search(r"(?:scan of|examination of|region|part)[\s:]+([^\n\r]+)", text, re.I)
        if part_match:
            body_part = part_match.group(1).strip()
        elif re.search(r"\bchest\b", text, re.I):
            body_part = "Chest"
        elif re.search(r"\bbrain\b", text, re.I):
            body_part = "Brain"
        elif re.search(r"\blumbar\s+spine\b|\bspine\b", text, re.I):
            body_part = "Spine"

        # Findings & Impression
        findings = None
        f_match = re.search(r"findings[\s:]+([\s\S]*?)(?=impression|\Z)", text, re.I)
        if f_match:
            findings = f_match.group(1).strip()

        impression = None
        imp_match = re.search(r"impression[\s:]+([^\n\r]+(?:\n[^\n\r]+)?)", text, re.I)
        if imp_match:
            impression = imp_match.group(1).strip()

        return ImagingReportData(
            patient_name=patient_name,
            radiologist_name=radiologist,
            imaging_center_or_hospital=center,
            report_date=date,
            modality=modality,
            body_part_or_region=body_part,
            clinical_indication=None,
            findings=findings,
            impression=impression,
        )

    # ==========================================================================
    # Consultation Record Parsing
    # ==========================================================================

    @classmethod
    def extract_consultation(cls, text: str) -> ConsultationData:
        patient_name = cls._extract_patient_name(text)
        doctor_name = cls._extract_doctor_name(text)
        clinic = cls._extract_clinic_or_hospital(text)
        date = cls._extract_date(text)

        complaint = None
        c_match = re.search(r"(?:chief\s+complaint|reason\s+for\s+visit)[\s:]+([^\n\r]+)", text, re.I)
        if c_match:
            complaint = c_match.group(1).strip()

        hpi = None
        hpi_match = re.search(r"(?:history\s+of\s+present\s+illness|hpi)[\s:]+([^\n\r]+)", text, re.I)
        if hpi_match:
            hpi = hpi_match.group(1).strip()

        exam = None
        exam_match = re.search(r"(?:physical\s+examination|exam)[\s:]+([^\n\r]+)", text, re.I)
        if exam_match:
            exam = exam_match.group(1).strip()

        plan = None
        plan_match = re.search(r"(?:assessment\s+and\s+plan|plan)[\s:]+([^\n\r]+)", text, re.I)
        if plan_match:
            plan = plan_match.group(1).strip()

        return ConsultationData(
            patient_name=patient_name,
            doctor_name=doctor_name,
            clinic_or_hospital=clinic,
            consultation_date=date,
            chief_complaint=complaint,
            history_of_present_illness=hpi,
            examination_findings=exam,
            assessment_and_plan=plan,
            follow_up_instructions=None,
        )

    # ==========================================================================
    # Discharge Summary Parsing
    # ==========================================================================

    @classmethod
    def extract_discharge_summary(cls, text: str) -> DischargeSummaryData:
        patient_name = cls._extract_patient_name(text)
        hospital = cls._extract_clinic_or_hospital(text)

        adm_date = None
        adm_match = re.search(r"(?:admission\s+date|date\s+of\s+admission)[\s:]*([^\n\r]+)", text, re.I)
        if adm_match:
            adm_date = cls._extract_date(adm_match.group(1))

        dis_date = None
        dis_match = re.search(r"(?:discharge\s+date|date\s+of\s+discharge)[\s:]*([^\n\r]+)", text, re.I)
        if dis_match:
            dis_date = cls._extract_date(dis_match.group(1))

        adm_diag = None
        adm_diag_m = re.search(r"(?:admission\s+diagnosis|admitting\s+diagnosis)[\s:]+([^\n\r]+)", text, re.I)
        if adm_diag_m:
            adm_diag = adm_diag_m.group(1).strip()

        dis_diag = None
        dis_diag_m = re.search(r"(?:discharge\s+diagnosis|final\s+diagnosis)[\s:]+([^\n\r]+)", text, re.I)
        if dis_diag_m:
            dis_diag = dis_diag_m.group(1).strip()

        course = None
        course_m = re.search(
            r"(?:hospital\s+course|course\s+in\s+hospital)[\s:]+([\s\S]*?)(?=condition\s+at\s+discharge|discharge\s+diagnos|discharge\s+medications|discharge\s+advice|\Z)",
            text,
            re.I,
        )
        if course_m:
            course = course_m.group(1).strip()[:500]

        advice = None
        advice_m = re.search(
            r"(?:discharge\s+advice|advice\s+at\s+discharge|follow[\s-]up)[\s:]+([^\n\r]+)",
            text,
            re.I,
        )
        if advice_m:
            advice = advice_m.group(1).strip()

        # Extract take-home / discharge medications if present
        discharge_meds = []
        med_section_m = re.search(
            r"(?:discharge\s+advice\s*&\s*)?(?:prescribed\s+)?(?:discharge\s+medications?|take[\s-]home\s+medications?)[\s\S]*",
            text,
            re.I,
        )
        if med_section_m:
            discharge_meds = cls._extract_medications(med_section_m.group(0))

        return DischargeSummaryData(
            patient_name=patient_name,
            hospital_name=hospital,
            admission_date=adm_date,
            discharge_date=dis_date,
            admission_diagnosis=adm_diag,
            discharge_diagnosis=dis_diag,
            hospital_course=course,
            discharge_medications=discharge_meds,
            discharge_advice=advice,
        )

    # ==========================================================================
    # Master Extraction Dispatcher
    # ==========================================================================

    @classmethod
    def extract_structured_data(
        cls, text: str, doc_type: DocumentType
    ) -> StructuredMedicalData:
        """
        Dispatches text extraction based on document type.
        Returns validated Pydantic models with nulls for unextracted fields.
        """
        if doc_type == DocumentType.PRESCRIPTION:
            return cls.extract_prescription(text)
        elif doc_type in [DocumentType.BLOOD_TEST, DocumentType.LAB_REPORT]:
            category = "Hematology" if doc_type == DocumentType.BLOOD_TEST else "Biochemistry"
            return cls.extract_lab_report(text, category=category)
        elif doc_type == DocumentType.IMAGING_REPORT:
            return cls.extract_imaging_report(text)
        elif doc_type == DocumentType.CONSULTATION_RECORD:
            return cls.extract_consultation(text)
        elif doc_type == DocumentType.DISCHARGE_SUMMARY:
            return cls.extract_discharge_summary(text)
        else:
            return GenericDocumentData(
                summary="Unclassified medical record. Original text preserved.",
                extracted_metadata={"char_count": len(text)},
            )

    # ==========================================================================
    # Verification & Review Evaluation
    # ==========================================================================

    @classmethod
    def evaluate_verification_needs(
        cls,
        data: StructuredMedicalData,
        doc_type: DocumentType,
        ocr_confidence: Optional[float],
    ) -> Tuple[List[str], bool, Optional[str]]:
        """
        Evaluates extracted structured data for uncertainty or missing critical information.
        Flags specific fields for user confirmation on the review screen.
        """
        flagged_fields: List[str] = []
        notes: List[str] = []

        # Check OCR confidence threshold
        if ocr_confidence is not None and ocr_confidence < 0.70:
            flagged_fields.append("ocr_text_clarity")
            notes.append(f"Low OCR text clarity (confidence: {round(ocr_confidence * 100, 1)}%). Manual review advised.")

        # Document specific checks
        if isinstance(data, PrescriptionData):
            if not data.patient_name:
                flagged_fields.append("patient_name")
            if not data.medications:
                flagged_fields.append("medications")
                notes.append("No medications detected in prescription.")
            else:
                for idx, med in enumerate(data.medications):
                    if not med.dosage:
                        flagged_fields.append(f"medication[{idx}].dosage")
                    if not med.frequency:
                        flagged_fields.append(f"medication[{idx}].frequency")

        elif isinstance(data, LabReportData):
            if not data.patient_name:
                flagged_fields.append("patient_name")
            if not data.tests:
                flagged_fields.append("tests")
                notes.append("No laboratory test analytes detected.")
            else:
                for idx, test in enumerate(data.tests):
                    if not test.measured_value:
                        flagged_fields.append(f"test[{idx}].measured_value")
                    if test.is_abnormal:
                        flagged_fields.append(f"test[{idx}].abnormal_value")

        elif isinstance(data, ImagingReportData):
            if not data.impression and not data.findings:
                flagged_fields.append("findings_and_impression")

        elif isinstance(data, DischargeSummaryData):
            if not data.discharge_diagnosis:
                flagged_fields.append("discharge_diagnosis")

        requires_review = len(flagged_fields) > 0
        review_note = " | ".join(notes) if notes else ("All fields verified clearly." if not requires_review else "Please verify flagged fields.")

        return flagged_fields, requires_review, review_note
