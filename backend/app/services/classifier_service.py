import re
from typing import Dict, List
from backend.app.schemas.document import DocumentType


class ClassifierService:
    """
    Deterministic rule-based document classifier based on extracted text.
    Strictly categorizes only when supported by evidence; defaults to OTHER.
    """

    # Core clinical signals required to establish a prescription
    PRESCRIPTION_CORE_PATTERNS: List[str] = [
        r"\brx\b|\brx[:\.]?",
        r"\bprescription\b",
        r"\btab(?:let)?s?[\.\s]",
        r"\bcap(?:sule)?s?[\.\s]",
        r"\bsyrup\b|\bsyp\b|\binj\b",
        r"\bdosage\b",
        r"\bsig[\s:]",
        r"\bod\b|\bbid\b|\btid\b|\bqid\b|\bhs\b|\bsos\b|\bprn\b",
        r"\bprescribed by\b|\bprescribing doctor\b",
        r"\b\d+\s*mg(?!\s*/)\b|\b\d+\s*ml(?!\s*/)\b|\b\d+\s*mcg(?!\s*/)\b",
        r"\bparacetamol\b|\bamoxicillin\b|\bmetformin\b|\batorvastatin\b|\bibuprofen\b|\bomeprazole\b|\baspirin\b|\bsumatriptan\b",
    ]

    # Secondary timing and frequency patterns (only count when core clinical evidence is present)
    PRESCRIPTION_TIMING_PATTERNS: List[str] = [
        r"\bonce daily\b|\btwice daily\b|\bthrice daily\b|\bdaily\b",
        r"\bafter meals\b|\bbefore meals\b|\bwith meals\b",
        r"\bat bedtime\b",
    ]

    PATTERNS: Dict[DocumentType, List[str]] = {
        DocumentType.PRESCRIPTION: [
            r"\brx\b|\brx[:\.]?",
            r"\bprescription\b",
            r"\btab(?:let)?s?[\.\s]",
            r"\bcap(?:sule)?s?[\.\s]",
            r"\bsyrup\b|\bsyp\b|\binj\b",
            r"\bdosage\b",
            r"\bsig[\s:]",
            r"\bod\b|\bbid\b|\btid\b|\bqid\b|\bhs\b|\bsos\b|\bprn\b",
            r"\bprescribed by\b|\bprescribing doctor\b",
            r"\b\d+\s*mg(?!\s*/)\b|\b\d+\s*ml(?!\s*/)\b|\b\d+\s*mcg(?!\s*/)\b",
            r"\bparacetamol\b|\bamoxicillin\b|\bmetformin\b|\batorvastatin\b|\bibuprofen\b|\bomeprazole\b|\baspirin\b|\bsumatriptan\b",
        ],
        DocumentType.BLOOD_TEST: [
            r"\bhemoglobin\b|\bhgb\b",
            r"\bcomplete blood count\b|\bcbc\b",
            r"\bwhite blood cells?\b|\bwbc\b",
            r"\bred blood cells?\b|\brbc\b",
            r"\bplatelet count\b|\bplatelets?\b",
            r"\bhematocrit\b",
            r"\bneutrophils\b",
            r"\blymphocytes\b",
            r"\beosinophils\b",
            r"\bmonocytes\b",
            r"\besr\b|\berythrocyte sedimentation\b",
            r"\bhematology\b",
        ],
        DocumentType.LAB_REPORT: [
            r"\blaboratory report\b|\blab report\b|\blaboratory\b|\blab\b",
            r"\breference range\b|\breference interval\b",
            r"\bbiochemistry\b|\bpathology\b",
            r"\bspecimen\b",
            r"\bserum\b|\bplasma\b|\burine analysis\b",
            r"\bcreatinine\b",
            r"\bblood urea nitrogen\b|\bbun\b",
            r"\blipid profile\b",
            r"\bfasting blood sugar\b|\bfbs\b|\bblood glucose\b",
            r"\bhba1c\b|\bhemoglobin a1c\b",
            r"\bdiagnostic laboratory\b|\bdiagnostic labs?\b",
            r"\bmg/dl\b|\bmg/l\b|\bmmol/l\b|\bg/dl\b|\biu/l\b|\bu/l\b",
        ],
        DocumentType.IMAGING_REPORT: [
            r"\bx-ray\b|\bxray\b",
            r"\bmri\b|\bmagnetic resonance\b",
            r"\bct scan\b|\bcomputed tomography\b",
            r"\bultrasound\b|\busg\b|\bsonography\b",
            r"\bradiology report\b",
            r"\bimpression\s*:",
            r"\bfindings\s*:",
            r"\bradiologist\b",
        ],
        DocumentType.DISCHARGE_SUMMARY: [
            r"\bdischarge summary\b|\binpatient discharge summary\b",
            r"\bdate of admission\b|\badmission date\b",
            r"\bdate of discharge\b|\bdischarge date\b",
            r"\bhospital course\b",
            r"\bcondition at discharge\b",
            r"\bdischarge advice\b",
            r"\binpatient summary\b",
            r"\bdischarge diagnos(?:is|es)\b|\bdischarge medications?\b",
        ],
        DocumentType.CONSULTATION_RECORD: [
            r"\bconsultation record\b|\bconsultation note\b",
            r"\bchief complaint\b",
            r"\bhistory of present illness\b|\bhpi\b",
            r"\bphysical examination\b|\bclinical examination\b",
            r"\bassessment and plan\b",
            r"\bclinical notes\b",
            r"\bfollow[\s-]up visit\b",
        ],
    }

    NON_MEDICAL_PATTERNS: List[str] = [
        # Resumes, CVs, and Employment Profiles
        r"\bcurriculum vitae\b|\bresume\b|\bcv\b",
        r"\bwork experience\b|\bprofessional experience\b|\bemployment history\b|\bcareer summary\b|\bexperience summary\b",
        r"\beducation\b|\bacademics\b|\bqualifications\b|\bacademic background\b",
        r"\bskills\b|\btechnical skills\b|\bcore competencies\b|\bprogramming languages\b|\btools & technologies\b",
        r"\bprojects\b|\bportfolio\b|\bgithub\.com\b|\blinkedin\.com\b",
        r"\bcertifications\b|\bachievements\b|\bawards\b|\bhonors\b",
        r"\bextracurricular\b|\bvolunteer experience\b|\bleadership\b",
        r"\breferences available\b|\breferences upon request\b|\breferences\b",
        r"\bgpa\b|\bdegree\b|\bbachelor\b|\bmaster\b|\bphd\b|\bdiploma\b|\bmatriculation\b",
        r"\buniversity\b|\bcollege\b|\binstitute of technology\b|\bschool\b",
        r"\bsoftware engineer\b|\bdeveloper\b|\bdata scientist\b|\banalyst\b|\bconsultant\b|\bmanager\b",
        r"\bobjective\b|\bcareer objective\b|\bprofessional profile\b",
        # Invoices, Receipts, and Financial Documents
        r"\binvoice\b|\btax invoice\b|\bbill to\b|\bship to\b",
        r"\bpurchase order\b|\bpo number\b|\binvoice number\b|\binvoice date\b",
        r"\btotal amount\b|\bamount due\b|\bsubtotal\b|\bpayment terms\b|\bpayment method\b",
        r"\bvat\b|\bgst\b|\bsales tax\b|\bdiscount\b|\breceipt\b",
        r"\baccount statement\b|\bbank statement\b|\bpayroll\b|\bpayslip\b|\bsalary\b",
        # Real Estate, Contracts, and Non-Medical Legal Agreements
        r"\blease agreement\b|\btenancy\b|\blandlord\b|\btenant\b|\brental agreement\b",
        r"\bnon-disclosure agreement\b|\bnda\b|\bterms and conditions\b|\bterms of service\b|\bemployment contract\b",
        # General correspondence
        r"\bto whom it may concern\b|\bdear sir\b|\bdear madam\b|\bsincerely\b|\bcover letter\b",
    ]

    @classmethod
    def classify_document(cls, text: str) -> tuple[DocumentType, float, bool, str]:
        """
        Classifies document text and evaluates medical relevance.
        Returns:
            (document_type, confidence_score, is_medical, explanation)
        """
        if not text or not text.strip():
            return (
                DocumentType.OTHER,
                0.0,
                False,
                "No readable text detected in document. OCR may have produced empty content.",
            )

        cleaned = text.lower()

        # 1. Compute non-medical indicators
        non_med_score = 0
        for pattern in cls.NON_MEDICAL_PATTERNS:
            matches = len(re.findall(pattern, cleaned))
            if matches > 0:
                non_med_score += matches

        # 2. Compute medical category indicators
        scores: Dict[DocumentType, int] = {doc_type: 0 for doc_type in cls.PATTERNS}
        for doc_type, regex_list in cls.PATTERNS.items():
            if doc_type == DocumentType.PRESCRIPTION:
                # Require primary clinical evidence (Rx, dosage units, meds)
                # Generic frequency/meal terms (e.g. daily, with meals) alone must not establish prescription evidence
                core_hits = sum(len(re.findall(p, cleaned)) for p in cls.PRESCRIPTION_CORE_PATTERNS)
                timing_hits = sum(len(re.findall(p, cleaned)) for p in cls.PRESCRIPTION_TIMING_PATTERNS)
                scores[DocumentType.PRESCRIPTION] = (core_hits + timing_hits) if core_hits > 0 else 0
            else:
                for pattern in regex_list:
                    matches = len(re.findall(pattern, cleaned))
                    if matches > 0:
                        scores[doc_type] += matches

        if scores[DocumentType.BLOOD_TEST] >= 2:
            scores[DocumentType.BLOOD_TEST] += 2

        # Discharge summary structural priority rule:
        # Explicit document identity takes priority over embedded content.
        # An inpatient discharge summary routinely contains take-home medication directives.
        # Those medication patterns must never override the discharge summary subtype.
        has_explicit_ds_title = bool(
            re.search(r"\bdischarge summary\b|\binpatient discharge summary\b", cleaned)
        )
        ds_matches = scores[DocumentType.DISCHARGE_SUMMARY]
        if has_explicit_ds_title or ds_matches >= 2:
            scores[DocumentType.DISCHARGE_SUMMARY] = max(
                ds_matches + 6,
                scores[DocumentType.PRESCRIPTION] + 4,
            )

        total_medical_score = sum(scores.values())
        best_type, best_score = max(scores.items(), key=lambda item: item[1])

        # 3. Decision Logic
        # Case A: Clear non-medical document (e.g. resume, invoice, agreement)
        if (non_med_score >= 1 and total_medical_score == 0) or (
            non_med_score >= 2 and non_med_score >= total_medical_score
        ):
            return (
                DocumentType.NON_MEDICAL,
                0.0,
                False,
                "Non-medical document detected (e.g. resume, CV, invoice, or non-clinical document). "
                "HealthSync AI only extracts and indexes genuine clinical records.",
            )

        # Case B: Confident medical document (requires at least 3 clinical indicators)
        if best_score >= 3 and best_score > non_med_score:
            conf = min(0.98, round(0.58 + (best_score * 0.06), 2))
            return (
                best_type,
                conf,
                True,
                f"Classified as {best_type.value.replace('_', ' ')} with supported clinical evidence.",
            )

        # Case C: Sparse or partial medical evidence (1-2 keywords)
        if best_score in (1, 2) and non_med_score == 0:
            conf = 0.40 if best_score == 1 else 0.60
            return (
                best_type,
                conf,
                True,
                f"Tentatively categorized as {best_type.value.replace('_', ' ')}. "
                "Evidence is sparse; clinical verification strongly recommended.",
            )

        # Case D: Ambiguous or unclassified document
        return (
            DocumentType.OTHER,
            0.0,
            False,
            "Document content does not match known clinical templates or has insufficient text. "
            "Please review manually.",
        )

    @classmethod
    def classify_text(cls, text: str) -> DocumentType:
        """
        Classifies document text into a medical document category.
        Maintained for backwards compatibility.
        """
        doc_type, _, _, _ = cls.classify_document(text)
        return doc_type
