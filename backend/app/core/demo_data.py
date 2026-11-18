"""
Centralized Alex Morgan Synthetic Demo Dataset & Orchestrated Seeder.

This module provides the single source of truth for the fictional patient Alex Morgan,
guaranteeing 100% data consistency across all application views:
- Patient Profile (Dashboard & Settings)
- Prescriptions (Prescriptions Vault & Reminders)
- Laboratory Panels & Biomarker Trends (Lab Reports, Health Trends, Timeline, Doctor Summary)
- Consultations & Imaging (Timeline, Doctor Summary)
- Emergency Health Card (QR access & first responder view)
- Family Profiles
- AI Assistant Preloaded Conversations & RAG Search Chunks
"""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import pymupdf

from backend.app.core.config import settings
from backend.app.schemas.document import DocumentType, DocumentStatus
from backend.app.utils.file_security import ensure_upload_dir

logger = logging.getLogger("healthsync.demo_data")

DEMO_USER_ID = "demo-patient-001"
DEMO_EMAIL = "alex.morgan@healthsync.ai"
DEMO_FULL_NAME = "Alex Morgan"
DEMO_DOB = "1988-04-12"
DEMO_GENDER = "Non-binary"
DEMO_BLOOD_GROUP = "O+"
DEMO_PHONE = "+1 (555) 019-4821"
DEMO_ADDRESS = "742 Evergreen Terrace, Springfield, OR 97477"
DEMO_EMERGENCY_CONTACT_NAME = "Jordan Morgan"
DEMO_EMERGENCY_CONTACT_PHONE = "+1 (555) 019-2834"
DEMO_EMERGENCY_CONTACT_RELATION = "Spouse"
DEMO_ALLERGIES = [
    "Latex (mild contact dermatitis)",
    "Sulfa antibiotics (cutaneous hives)",
]
DEMO_MEDICATIONS = [
    "Lisinopril 10mg oral daily (08:00 AM)",
    "Metformin 500mg oral twice daily with meals (08:30 AM, 07:30 PM)",
]
DEMO_CRITICAL_NOTES = (
    "DEMO PATIENT RECORD. Fictional data for demonstration purposes only. "
    "Known allergy to Sulfa antibiotics (cutaneous hives, carries medical alert). "
    "Mild essential hypertension well-managed on Lisinopril. Blood group O-positive."
)


# =============================================================================
# 1. HELPER: SYNTHETIC PDF GENERATOR
# =============================================================================

def _create_synthetic_pdf(filepath: Path, title: str, lines: List[str]) -> None:
    """Generates a clean, professional synthetic medical PDF with PyMuPDF."""
    if filepath.exists() and filepath.stat().st_size > 500:
        return

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # A4 size

    # Header Banner
    page.draw_rect(pymupdf.Rect(40, 40, 555, 95), color=(0.1, 0.4, 0.6), fill=(0.94, 0.97, 1.0), width=1)
    page.insert_text(pymupdf.Point(55, 68), title, fontsize=14, fontname="helv", color=(0.05, 0.25, 0.45))
    page.insert_text(pymupdf.Point(55, 84), "DEMONSTRATION MEDICAL RECORD - FICTIONAL PATIENT (ALEX MORGAN)", fontsize=8.5, fontname="helv", color=(0.7, 0.1, 0.1))

    # Body Content
    y = 120
    for line in lines:
        if line.startswith("---"):
            page.draw_line(pymupdf.Point(40, y), pymupdf.Point(555, y), color=(0.8, 0.85, 0.9), width=0.8)
            y += 18
        elif line.startswith("# "):
            page.insert_text(pymupdf.Point(45, y), line[2:], fontsize=11, fontname="helv", color=(0.1, 0.2, 0.35))
            y += 18
        else:
            page.insert_text(pymupdf.Point(50, y), line, fontsize=9.5, fontname="helv", color=(0.15, 0.15, 0.2))
            y += 15

    # Footer Disclaimer
    page.draw_line(pymupdf.Point(40, 800), pymupdf.Point(555, 800), color=(0.85, 0.85, 0.85), width=0.5)
    page.insert_text(pymupdf.Point(45, 815), "HealthSync AI synthetic demonstration document. Fictional patient data for hackathon evaluation only.", fontsize=7.5, fontname="helv", color=(0.5, 0.5, 0.55))

    doc.save(str(filepath))
    doc.close()


# =============================================================================
# 2. CENTRALIZED MEDICAL DOCUMENTS SPECIFICATION (8 Records)
# =============================================================================

def get_demo_documents_spec() -> Dict[str, Dict[str, Any]]:
    """Returns the canonical dictionary of all 8 Alex Morgan synthetic documents."""
    return {
        # --- DOCUMENT 1: Prescriptions ---
        "demo-doc-rx-lisinopril": {
            "document_id": "demo-doc-rx-lisinopril",
            "original_filename": "Prescription_Lisinopril_10mg.pdf",
            "stored_filename": "demo_rx_lisinopril.pdf",
            "document_type": DocumentType.PRESCRIPTION.value,
            "status": DocumentStatus.EXTRACTED.value,
            "created_at": "2026-05-15T09:30:00Z",
            "pdf_title": "METRO CARDIOLOGY ASSOCIATES - PRESCRIPTION",
            "pdf_lines": [
                "Provider: Dr. Robert Chen, MD (Cardiology) | License: #MD-883921",
                "Clinic: Metro Cardiology Associates, Suite 400, Springfield, OR",
                "Patient: Alex Morgan | DOB: 1988-04-12 | Date: 2026-05-15",
                "---",
                "# CLINICAL DIAGNOSIS & PRESCRIPTION",
                "Diagnosis: Primary Essential Hypertension (ICD-10 I10)",
                "Rx: Lisinopril 10 mg Oral Tablet",
                "Sig: Take 1 tablet orally once daily every morning with water.",
                "Dispense: 90 tablets | Refills: 3",
                "Notes: Monitor blood pressure weekly; follow-up comprehensive panel in 3 months.",
            ],
            "raw_text": (
                "METRO CARDIOLOGY ASSOCIATES - PRESCRIPTION ORDER\n"
                "Physician: Dr. Robert Chen, MD (Cardiology)\n"
                "Patient: Alex Morgan | DOB: 1988-04-12 | Date: 2026-05-15\n"
                "Diagnosis: Primary Essential Hypertension\n"
                "Rx: Lisinopril 10 mg Oral Tablet\n"
                "Sig: Take 1 tablet orally once daily in the morning with water.\n"
                "Dispense: 90 tablets | Refills: 3"
            ),
            "structured_data": {
                "patient_name": DEMO_FULL_NAME,
                "doctor_name": "Dr. Robert Chen, MD",
                "clinic_or_hospital": "Metro Cardiology Associates",
                "prescription_date": "2026-05-15",
                "diagnosis_text": "Primary Essential Hypertension (Synthetic Demo)",
                "medications": [
                    {
                        "name": "Lisinopril",
                        "dosage": "10 mg",
                        "frequency": "Once daily (Morning)",
                        "duration": "90 days",
                        "instructions": "Take 1 tablet orally once daily in the morning with water",
                    }
                ],
            },
            "ocr_confidence": 0.98,
            "needs_human_review": False,
        },

        "demo-doc-rx-metformin": {
            "document_id": "demo-doc-rx-metformin",
            "original_filename": "Prescription_Metformin_500mg.pdf",
            "stored_filename": "demo_rx_metformin.pdf",
            "document_type": DocumentType.PRESCRIPTION.value,
            "status": DocumentStatus.EXTRACTED.value,
            "created_at": "2026-08-20T10:15:00Z",
            "pdf_title": "METRO HEALTH FAMILY MEDICINE - PRESCRIPTION",
            "pdf_lines": [
                "Provider: Dr. Sarah Lin, MD (Family Medicine) | License: #MD-774012",
                "Clinic: Metro Health Family Medicine, Springfield, OR",
                "Patient: Alex Morgan | DOB: 1988-04-12 | Date: 2026-08-20",
                "---",
                "# CLINICAL DIAGNOSIS & PRESCRIPTION",
                "Diagnosis: Impaired Fasting Glucose / Metabolic Review (ICD-10 R73.01)",
                "Rx: Metformin Hydrochloride 500 mg Extended-Release Tablet",
                "Sig: Take 1 tablet orally twice daily with meals (morning and evening).",
                "Dispense: 60 tablets | Refills: 2",
                "Notes: Maintain low glycemic dietary guidelines. Re-evaluate in 90 days.",
            ],
            "raw_text": (
                "METRO HEALTH FAMILY MEDICINE - PRESCRIPTION ORDER\n"
                "Physician: Dr. Sarah Lin, MD\n"
                "Patient: Alex Morgan | DOB: 1988-04-12 | Date: 2026-08-20\n"
                "Diagnosis: Impaired Fasting Glucose\n"
                "Rx: Metformin HCl 500 mg Extended-Release Tablet\n"
                "Sig: Take 1 tablet orally twice daily with meals (morning and evening).\n"
                "Dispense: 60 tablets | Refills: 2"
            ),
            "structured_data": {
                "patient_name": DEMO_FULL_NAME,
                "doctor_name": "Dr. Sarah Lin, MD",
                "clinic_or_hospital": "Metro Health Family Medicine",
                "prescription_date": "2026-08-20",
                "diagnosis_text": "Impaired Fasting Glucose (Synthetic Demo)",
                "medications": [
                    {
                        "name": "Metformin Extended-Release",
                        "dosage": "500 mg",
                        "frequency": "Twice daily with meals",
                        "duration": "60 days",
                        "instructions": "Take 1 tablet orally twice daily with breakfast and dinner",
                    }
                ],
            },
            "ocr_confidence": 0.97,
            "needs_human_review": False,
        },

        "demo-doc-rx-amoxicillin": {
            "document_id": "demo-doc-rx-amoxicillin",
            "original_filename": "Prescription_Amoxicillin_500mg.pdf",
            "stored_filename": "demo_rx_amoxicillin.pdf",
            "document_type": DocumentType.PRESCRIPTION.value,
            "status": DocumentStatus.EXTRACTED.value,
            "created_at": "2026-11-10T14:00:00Z",
            "pdf_title": "METRO HEALTH URGENT CARE - ACUTE PRESCRIPTION",
            "pdf_lines": [
                "Provider: Dr. Sarah Lin, MD | Urgent Care Clinic",
                "Patient: Alex Morgan | DOB: 1988-04-12 | Date: 2026-11-10",
                "---",
                "# ACUTE INFECTION PRESCRIPTION",
                "Diagnosis: Acute Bacterial Sinusitis (ICD-10 J01.90)",
                "Rx: Amoxicillin 500 mg Capsule",
                "Sig: Take 1 capsule orally every 8 hours with food for 10 days.",
                "Dispense: 30 capsules | Refills: 0 (Completed Short Course)",
                "Allergy Confirmation: No penicillin allergy noted; sulfa allergy flagged.",
            ],
            "raw_text": (
                "METRO HEALTH URGENT CARE - PRESCRIPTION\n"
                "Doctor: Dr. Sarah Lin, MD\n"
                "Patient: Alex Morgan | Date: 2026-11-10\n"
                "Diagnosis: Acute Bacterial Sinusitis\n"
                "Rx: Amoxicillin 500 mg Capsule\n"
                "Sig: Take 1 capsule orally every 8 hours with food for 10 days.\n"
                "Dispense: 30 capsules | Refills: 0 (Course Completed)"
            ),
            "structured_data": {
                "patient_name": DEMO_FULL_NAME,
                "doctor_name": "Dr. Sarah Lin, MD",
                "clinic_or_hospital": "Metro Health Urgent Care",
                "prescription_date": "2026-11-10",
                "diagnosis_text": "Acute Bacterial Sinusitis (Completed Course)",
                "medications": [
                    {
                        "name": "Amoxicillin Capsule",
                        "dosage": "500 mg",
                        "frequency": "Every 8 hours",
                        "duration": "10 days",
                        "instructions": "Take 1 capsule orally every 8 hours with food. Complete entire course.",
                    }
                ],
            },
            "ocr_confidence": 0.99,
            "needs_human_review": False,
        },

        # --- DOCUMENT 2: Longitudinal Lab Panels (May, Aug, Nov) ---
        "demo-doc-lab-lipid-may": {
            "document_id": "demo-doc-lab-lipid-may",
            "original_filename": "Lab_Report_Lipid_Panel_May2026.pdf",
            "stored_filename": "demo_lab_may2026.pdf",
            "document_type": DocumentType.LAB_REPORT.value,
            "status": DocumentStatus.EXTRACTED.value,
            "created_at": "2026-05-15T11:00:00Z",
            "pdf_title": "QUEST DIAGNOSTICS - CLINICAL LABORATORY REPORT",
            "pdf_lines": [
                "Laboratory: Quest Diagnostics Clinical Laboratories | CLIA #99D1029384",
                "Ordering Physician: Dr. Robert Chen, MD | Patient: Alex Morgan",
                "Specimen Collected: 2026-05-15 08:15 AM | Fasting: Yes (12 Hours)",
                "---",
                "# LIPID PANEL & CARDIOVASCULAR RISK MARKERS",
                "Total Cholesterol:       215 mg/dL     (Ref: 125 - 200)    [HIGH]",
                "LDL Cholesterol:         135 mg/dL     (Ref: 0 - 100)      [HIGH]",
                "HDL Cholesterol:          48 mg/dL     (Ref: 40 - 60)      [NORMAL]",
                "Triglycerides:           160 mg/dL     (Ref: 0 - 150)      [HIGH]",
                "Fasting Blood Glucose:   110 mg/dL     (Ref: 70 - 99)      [HIGH]",
                "Serum ALT:                28 U/L       (Ref: 7 - 56)       [NORMAL]",
                "Systolic Blood Pressure: 138 mmHg      (Ref: 90 - 120)     [HIGH]",
                "Diastolic Blood Pressure: 88 mmHg      (Ref: 60 - 80)      [HIGH]",
            ],
            "raw_text": (
                "QUEST DIAGNOSTICS CLINICAL REPORT\n"
                "Date: 2026-05-15 | Patient: Alex Morgan\n"
                "Total Cholesterol: 215 mg/dL (Ref: 125-200) HIGH\n"
                "LDL Cholesterol: 135 mg/dL (Ref: 0-100) HIGH\n"
                "HDL Cholesterol: 48 mg/dL (Ref: 40-60) NORMAL\n"
                "Triglycerides: 160 mg/dL (Ref: 0-150) HIGH\n"
                "Fasting Blood Glucose: 110 mg/dL (Ref: 70-99) HIGH\n"
                "Serum ALT: 28 U/L (Ref: 7-56) NORMAL\n"
                "Systolic Blood Pressure: 138 mmHg (Ref: 90-120) HIGH\n"
                "Diastolic Blood Pressure: 88 mmHg (Ref: 60-80) HIGH"
            ),
            "structured_data": {
                "patient_name": DEMO_FULL_NAME,
                "doctor_or_lab_name": "Quest Diagnostics",
                "report_date": "2026-05-15",
                "test_category": "Lipid & Baseline Metabolic Panel",
                "tests": [
                    {"test_name": "Total Cholesterol", "measured_value": "215", "unit": "mg/dL", "reference_range": "125 - 200", "is_abnormal": True, "flag": "HIGH"},
                    {"test_name": "LDL Cholesterol", "measured_value": "135", "unit": "mg/dL", "reference_range": "0 - 100", "is_abnormal": True, "flag": "HIGH"},
                    {"test_name": "HDL Cholesterol", "measured_value": "48", "unit": "mg/dL", "reference_range": "40 - 60", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Triglycerides", "measured_value": "160", "unit": "mg/dL", "reference_range": "0 - 150", "is_abnormal": True, "flag": "HIGH"},
                    {"test_name": "Fasting Blood Glucose", "measured_value": "110", "unit": "mg/dL", "reference_range": "70 - 99", "is_abnormal": True, "flag": "HIGH"},
                    {"test_name": "Serum ALT", "measured_value": "28", "unit": "U/L", "reference_range": "7 - 56", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Systolic Blood Pressure", "measured_value": "138", "unit": "mmHg", "reference_range": "90 - 120", "is_abnormal": True, "flag": "HIGH"},
                    {"test_name": "Diastolic Blood Pressure", "measured_value": "88", "unit": "mmHg", "reference_range": "60 - 80", "is_abnormal": True, "flag": "HIGH"},
                ],
            },
            "ocr_confidence": 0.98,
            "needs_human_review": False,
        },

        "demo-doc-lab-cmp-aug": {
            "document_id": "demo-doc-lab-cmp-aug",
            "original_filename": "Lab_Report_CMP_August2026.pdf",
            "stored_filename": "demo_lab_aug2026.pdf",
            "document_type": DocumentType.LAB_REPORT.value,
            "status": DocumentStatus.EXTRACTED.value,
            "created_at": "2026-08-20T11:30:00Z",
            "pdf_title": "QUEST DIAGNOSTICS - COMPREHENSIVE METABOLIC PANEL",
            "pdf_lines": [
                "Laboratory: Quest Diagnostics Clinical Laboratories | CLIA #99D1029384",
                "Ordering Physician: Dr. Sarah Lin, MD | Patient: Alex Morgan",
                "Specimen Collected: 2026-08-20 08:30 AM | Fasting: Yes (12 Hours)",
                "---",
                "# COMPREHENSIVE METABOLIC PANEL RESULTS",
                "Fasting Blood Glucose:   104 mg/dL     (Ref: 70 - 99)      [HIGH]",
                "Total Cholesterol:       202 mg/dL     (Ref: 125 - 200)    [HIGH]",
                "LDL Cholesterol:         124 mg/dL     (Ref: 0 - 100)      [HIGH]",
                "HDL Cholesterol:          52 mg/dL     (Ref: 40 - 60)      [NORMAL]",
                "Serum Sodium:            139 mEq/L     (Ref: 135 - 145)    [NORMAL]",
                "Serum Potassium:         4.3 mEq/L     (Ref: 3.5 - 5.0)    [NORMAL]",
                "Serum Calcium:           9.5 mg/dL     (Ref: 8.5 - 10.2)   [NORMAL]",
                "Serum ALT:                26 U/L       (Ref: 7 - 56)       [NORMAL]",
                "Serum Creatinine:        0.9 mg/dL     (Ref: 0.6 - 1.2)    [NORMAL]",
                "Systolic Blood Pressure: 130 mmHg      (Ref: 90 - 120)     [HIGH]",
                "Diastolic Blood Pressure: 84 mmHg      (Ref: 60 - 80)      [HIGH]",
            ],
            "raw_text": (
                "QUEST DIAGNOSTICS CMP REPORT\n"
                "Date: 2026-08-20 | Patient: Alex Morgan\n"
                "Fasting Blood Glucose: 104 mg/dL (Ref: 70-99) HIGH\n"
                "Total Cholesterol: 202 mg/dL (Ref: 125-200) HIGH\n"
                "LDL Cholesterol: 124 mg/dL (Ref: 0-100) HIGH\n"
                "HDL Cholesterol: 52 mg/dL (Ref: 40-60) NORMAL\n"
                "Serum Sodium: 139 mEq/L (Ref: 135-145) NORMAL\n"
                "Serum Potassium: 4.3 mEq/L (Ref: 3.5-5.0) NORMAL\n"
                "Serum Calcium: 9.5 mg/dL (Ref: 8.5-10.2) NORMAL\n"
                "Serum ALT: 26 U/L (Ref: 7-56) NORMAL\n"
                "Serum Creatinine: 0.9 mg/dL (Ref: 0.6-1.2) NORMAL\n"
                "Systolic Blood Pressure: 130 mmHg (Ref: 90-120) HIGH\n"
                "Diastolic Blood Pressure: 84 mmHg (Ref: 60-80) HIGH"
            ),
            "structured_data": {
                "patient_name": DEMO_FULL_NAME,
                "doctor_or_lab_name": "Quest Diagnostics",
                "report_date": "2026-08-20",
                "test_category": "Comprehensive Metabolic & Lipid Panel",
                "tests": [
                    {"test_name": "Fasting Blood Glucose", "measured_value": "104", "unit": "mg/dL", "reference_range": "70 - 99", "is_abnormal": True, "flag": "HIGH"},
                    {"test_name": "Total Cholesterol", "measured_value": "202", "unit": "mg/dL", "reference_range": "125 - 200", "is_abnormal": True, "flag": "HIGH"},
                    {"test_name": "LDL Cholesterol", "measured_value": "124", "unit": "mg/dL", "reference_range": "0 - 100", "is_abnormal": True, "flag": "HIGH"},
                    {"test_name": "HDL Cholesterol", "measured_value": "52", "unit": "mg/dL", "reference_range": "40 - 60", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Serum Sodium", "measured_value": "139", "unit": "mEq/L", "reference_range": "135 - 145", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Serum Potassium", "measured_value": "4.3", "unit": "mEq/L", "reference_range": "3.5 - 5.0", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Serum Calcium", "measured_value": "9.5", "unit": "mg/dL", "reference_range": "8.5 - 10.2", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Serum ALT", "measured_value": "26", "unit": "U/L", "reference_range": "7 - 56", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Serum Creatinine", "measured_value": "0.9", "unit": "mg/dL", "reference_range": "0.6 - 1.2", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Systolic Blood Pressure", "measured_value": "130", "unit": "mmHg", "reference_range": "90 - 120", "is_abnormal": True, "flag": "HIGH"},
                    {"test_name": "Diastolic Blood Pressure", "measured_value": "84", "unit": "mmHg", "reference_range": "60 - 80", "is_abnormal": True, "flag": "HIGH"},
                ],
            },
            "ocr_confidence": 0.98,
            "needs_human_review": False,
        },

        "demo-doc-lab-panels-nov": {
            "document_id": "demo-doc-lab-panels-nov",
            "original_filename": "Lab_Report_Metabolic_FollowUp_Nov2026.pdf",
            "stored_filename": "demo_lab_nov2026.pdf",
            "document_type": DocumentType.LAB_REPORT.value,
            "status": DocumentStatus.EXTRACTED.value,
            "created_at": "2026-11-12T10:00:00Z",
            "pdf_title": "QUEST DIAGNOSTICS - CLINICAL FOLLOW-UP PANEL",
            "pdf_lines": [
                "Laboratory: Quest Diagnostics Clinical Laboratories | CLIA #99D1029384",
                "Ordering Physician: Dr. Sarah Lin, MD | Patient: Alex Morgan",
                "Specimen Collected: 2026-11-12 08:00 AM | Fasting: Yes (12 Hours)",
                "---",
                "# METABOLIC, LIPID & GLYCEMIC FOLLOW-UP (NORMALIZED)",
                "Fasting Blood Glucose:    92 mg/dL     (Ref: 70 - 99)      [NORMAL]",
                "Total Cholesterol:       188 mg/dL     (Ref: 125 - 200)    [NORMAL]",
                "LDL Cholesterol:         110 mg/dL     (Ref: 0 - 100)      [NORMAL]",
                "HDL Cholesterol:          55 mg/dL     (Ref: 40 - 60)      [NORMAL]",
                "Triglycerides:           125 mg/dL     (Ref: 0 - 150)      [NORMAL]",
                "Serum ALT:                24 U/L       (Ref: 7 - 56)       [NORMAL]",
                "Hemoglobin A1c:          5.5 %         (Ref: 4.0 - 5.6)    [NORMAL]",
                "Serum Sodium:            140 mEq/L     (Ref: 135 - 145)    [NORMAL]",
                "Serum Potassium:         4.2 mEq/L     (Ref: 3.5 - 5.0)    [NORMAL]",
                "Systolic Blood Pressure: 122 mmHg      (Ref: 90 - 120)     [NORMAL]",
                "Diastolic Blood Pressure: 80 mmHg      (Ref: 60 - 80)      [NORMAL]",
            ],
            "raw_text": (
                "QUEST DIAGNOSTICS FOLLOW-UP REPORT\n"
                "Date: 2026-11-12 | Patient: Alex Morgan\n"
                "Fasting Blood Glucose: 92 mg/dL (Ref: 70-99) NORMAL\n"
                "Total Cholesterol: 188 mg/dL (Ref: 125-200) NORMAL\n"
                "LDL Cholesterol: 110 mg/dL (Ref: 0-100) NORMAL\n"
                "HDL Cholesterol: 55 mg/dL (Ref: 40-60) NORMAL\n"
                "Triglycerides: 125 mg/dL (Ref: 0-150) NORMAL\n"
                "Serum ALT: 24 U/L (Ref: 7-56) NORMAL\n"
                "Hemoglobin A1c: 5.5 % (Ref: 4.0-5.6) NORMAL\n"
                "Serum Sodium: 140 mEq/L (Ref: 135-145) NORMAL\n"
                "Serum Potassium: 4.2 mEq/L (Ref: 3.5-5.0) NORMAL\n"
                "Systolic Blood Pressure: 122 mmHg (Ref: 90-120) NORMAL\n"
                "Diastolic Blood Pressure: 80 mmHg (Ref: 60-80) NORMAL"
            ),
            "structured_data": {
                "patient_name": DEMO_FULL_NAME,
                "doctor_or_lab_name": "Quest Diagnostics",
                "report_date": "2026-11-12",
                "test_category": "Comprehensive Follow-up Panel",
                "tests": [
                    {"test_name": "Fasting Blood Glucose", "measured_value": "92", "unit": "mg/dL", "reference_range": "70 - 99", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Total Cholesterol", "measured_value": "188", "unit": "mg/dL", "reference_range": "125 - 200", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "LDL Cholesterol", "measured_value": "110", "unit": "mg/dL", "reference_range": "0 - 100", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "HDL Cholesterol", "measured_value": "55", "unit": "mg/dL", "reference_range": "40 - 60", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Triglycerides", "measured_value": "125", "unit": "mg/dL", "reference_range": "0 - 150", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Serum ALT", "measured_value": "24", "unit": "U/L", "reference_range": "7 - 56", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Hemoglobin A1c", "measured_value": "5.5", "unit": "%", "reference_range": "4.0 - 5.6", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Serum Sodium", "measured_value": "140", "unit": "mEq/L", "reference_range": "135 - 145", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Serum Potassium", "measured_value": "4.2", "unit": "mEq/L", "reference_range": "3.5 - 5.0", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Systolic Blood Pressure", "measured_value": "122", "unit": "mmHg", "reference_range": "90 - 120", "is_abnormal": False, "flag": "NORMAL"},
                    {"test_name": "Diastolic Blood Pressure", "measured_value": "80", "unit": "mmHg", "reference_range": "60 - 80", "is_abnormal": False, "flag": "NORMAL"},
                ],
            },
            "ocr_confidence": 0.99,
            "needs_human_review": True,  # Provides one document needing review in the demo dashboard
        },

        # --- DOCUMENT 3: Consultation & Wellness Summary ---
        "demo-doc-consult-annual": {
            "document_id": "demo-doc-consult-annual",
            "original_filename": "Consultation_Annual_Wellness_Summary.pdf",
            "stored_filename": "demo_consult_annual.pdf",
            "document_type": DocumentType.CONSULTATION_RECORD.value,
            "status": DocumentStatus.EXTRACTED.value,
            "created_at": "2026-10-05T15:30:00Z",
            "pdf_title": "METRO HEALTH - ANNUAL CLINICAL WELLNESS SUMMARY",
            "pdf_lines": [
                "Clinician: Dr. Sarah Lin, MD | Clinic: Metro Health Family Medicine",
                "Patient: Alex Morgan | Visit Type: Annual Health Maintenance Examination",
                "Date of Service: 2026-10-05 | Department: Primary Care",
                "---",
                "# CLINICAL ASSESSMENT & PLAN",
                "1. Essential Hypertension: Well-controlled on Lisinopril 10mg daily. Home BP logs 120s/80s.",
                "2. Metabolic Profile: Impaired fasting glucose improving on Metformin 500mg BID and aerobic exercise.",
                "3. Preventive Health: Influenza vaccine administered today (left deltoid, Lot #FL-8812).",
                "4. Allergies Confirmed: Sulfa antibiotics (cutaneous hives), Latex (dermatitis). No penicillin allergy.",
                "Follow-up: Routine repeat labs scheduled for November 2026.",
            ],
            "raw_text": (
                "METRO HEALTH ANNUAL WELLNESS SUMMARY\n"
                "Physician: Dr. Sarah Lin, MD\n"
                "Patient: Alex Morgan | Date: 2026-10-05\n"
                "Assessment:\n"
                "1. Essential Hypertension: Well-controlled on Lisinopril 10mg.\n"
                "2. Metabolic Management: Favorable glycemic trend on Metformin 500mg BID.\n"
                "3. Preventive: Annual influenza vaccine administered.\n"
                "Allergies: Sulfa antibiotics, Latex.\n"
                "Plan: Repeat fasting labs in 1 month."
            ),
            "structured_data": {
                "patient_name": DEMO_FULL_NAME,
                "doctor_name": "Dr. Sarah Lin, MD",
                "clinic_name": "Metro Health Family Medicine",
                "visit_date": "2026-10-05",
                "chief_complaint": "Annual Comprehensive Wellness & Preventive Evaluation",
                "diagnoses": [
                    "Primary Essential Hypertension (Controlled)",
                    "Impaired Fasting Glucose (Improving)",
                ],
                "medications": [
                    {"name": "Lisinopril", "dosage": "10 mg", "frequency": "Once daily"},
                    {"name": "Metformin ER", "dosage": "500 mg", "frequency": "Twice daily with meals"},
                ],
                "clinical_notes": "Patient actively maintains regular exercise and dietary sodium moderation. Blood pressure targets met.",
            },
            "ocr_confidence": 0.96,
            "needs_human_review": False,
        },

        # --- DOCUMENT 4: Imaging Report ---
        "demo-doc-imaging-chest": {
            "document_id": "demo-doc-imaging-chest",
            "original_filename": "Radiology_Chest_PA_Lateral.pdf",
            "stored_filename": "demo_imaging_chest.pdf",
            "document_type": DocumentType.IMAGING_REPORT.value,
            "status": DocumentStatus.EXTRACTED.value,
            "created_at": "2026-06-18T13:45:00Z",
            "pdf_title": "METRO DIAGNOSTIC IMAGING - RADIOLOGY REPORT",
            "pdf_lines": [
                "Facility: Metro Diagnostic Imaging Center | Springfield, OR",
                "Radiologist: Dr. Michael Chang, MD | License: #RD-440192",
                "Patient: Alex Morgan | Examination Date: 2026-06-18",
                "Procedure: Chest Radiograph - 2 Views (PA and Lateral)",
                "---",
                "# RADIOLOGICAL FINDINGS & IMPRESSION",
                "Indication: Pre-procedural baseline / routine chest evaluation.",
                "Lungs: Clear without focal alveolar consolidation, pneumothorax, or pleural effusion.",
                "Cardiomediastinal Silhouette: Normal heart size and contour within normal limits.",
                "Bony Structures: Intact osseous thorax without acute fracture.",
                "IMPRESSION: Normal 2-view chest radiograph. No acute cardiopulmonary abnormality.",
            ],
            "raw_text": (
                "METRO DIAGNOSTIC IMAGING REPORT\n"
                "Radiologist: Dr. Michael Chang, MD\n"
                "Patient: Alex Morgan | Date: 2026-06-18\n"
                "Procedure: 2-View Chest Radiograph (PA & Lateral)\n"
                "Findings: Lungs clear. Heart size normal. No pleural effusion or pneumothorax.\n"
                "Impression: Normal two-view chest examination without acute cardiopulmonary disease."
            ),
            "structured_data": {
                "patient_name": DEMO_FULL_NAME,
                "radiologist_name": "Dr. Michael Chang, MD",
                "imaging_center_or_hospital": "Metro Diagnostic Imaging Center",
                "report_date": "2026-06-18",
                "modality": "Radiography (X-Ray)",
                "body_part_or_region": "Chest (Thorax)",
                "findings": "Lungs are clear bilaterally. No pulmonary edema or consolidation. Normal cardiac size.",
                "impression": "Normal two-view chest radiograph. No acute cardiopulmonary findings.",
            },
            "ocr_confidence": 0.98,
            "needs_human_review": False,
        },
    }


# =============================================================================
# 3. SEEDING IMPLEMENTATIONS FOR ALL DOMAINS
# =============================================================================

def seed_demo_documents(user_id: str) -> None:
    """Seeds the 8 synthetic documents and their PDFs into the local storage vault."""
    upload_dir = ensure_upload_dir()
    meta_file = upload_dir / "metadata.json"

    records: Dict[str, Any] = {}
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                records = json.load(f)
        except Exception:
            records = {}

    specs = get_demo_documents_spec()
    changed = False

    for doc_id, spec in specs.items():
        pdf_path = upload_dir / spec["stored_filename"]
        _create_synthetic_pdf(pdf_path, spec["pdf_title"], spec["pdf_lines"])

        if doc_id not in records:
            file_size = pdf_path.stat().st_size if pdf_path.exists() else 15000
            now_iso = spec["created_at"]

            records[doc_id] = {
                "document_id": doc_id,
                "user_id": user_id,
                "original_filename": spec["original_filename"],
                "stored_filename": spec["stored_filename"],
                "storage_path": spec["stored_filename"],
                "mime_type": "application/pdf",
                "file_size_bytes": file_size,
                "status": spec["status"],
                "document_type": spec["document_type"],
                "raw_text": spec["raw_text"],
                "extraction_result": {
                    "document_id": doc_id,
                    "document_type": spec["document_type"],
                    "raw_text": spec["raw_text"],
                    "page_count": 1,
                    "ocr_engine": "pymupdf_native_text",
                    "confidence": spec["ocr_confidence"],
                    "confidence_method": "digital_pdf_stream",
                    "confidence_info": {
                        "ocr_confidence": spec["ocr_confidence"],
                        "llm_confidence": None,
                        "overall_confidence": spec["ocr_confidence"],
                        "confidence_method": "digital_pdf_stream (Calibrated Clinical Extraction)",
                        "is_calibrated": True,
                    },
                    "structured_data": spec["structured_data"],
                    "llm_extracted": False,
                    "fields_requiring_verification": [],
                    "requires_verification": spec["needs_human_review"],
                    "extraction_notes": "Clinical extraction with calibrated confidence scoring (Synthetic Demo Record).",
                    "disclaimer": settings.MEDICAL_DISCLAIMER,
                },
                "needs_human_review": spec["needs_human_review"],
                "requires_verification": spec["needs_human_review"],
                "user_reviewed": not spec["needs_human_review"],
                "user_reviewed_at": now_iso if not spec["needs_human_review"] else None,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            changed = True

    if changed:
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, default=str)
        logger.info("Successfully seeded %d synthetic demo documents for %s", len(specs), user_id)


def seed_demo_reminders(user_id: str) -> None:
    """Seeds medication schedules, daily reminders, and 7-day adherence stats for Alex Morgan."""
    upload_dir = ensure_upload_dir()
    reminders_file = upload_dir / "medication_reminders.json"

    data = {"schedules": {}, "reminders": {}, "logs": {}}
    if reminders_file.exists():
        try:
            with open(reminders_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {"schedules": {}, "reminders": {}, "logs": {}}

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    sched_lisinopril_id = "demo-sched-lisinopril"
    sched_metformin_id = "demo-sched-metformin"

    # 1. Schedules
    data["schedules"][sched_lisinopril_id] = {
        "id": sched_lisinopril_id,
        "user_id": user_id,
        "medication_name": "Lisinopril",
        "dosage": "10mg",
        "frequency": "ONCE_DAILY",
        "reminder_times": ["08:00"],
        "timezone": "UTC",
        "start_date": "2026-05-15",
        "end_date": None,
        "instructions": "Take 1 tablet every morning with water for blood pressure control.",
        "is_active": True,
        "user_confirmed": True,
        "document_id": "demo-doc-rx-lisinopril",
        "created_at": "2026-05-15T09:30:00Z",
        "updated_at": "2026-05-15T09:30:00Z",
    }

    data["schedules"][sched_metformin_id] = {
        "id": sched_metformin_id,
        "user_id": user_id,
        "medication_name": "Metformin",
        "dosage": "500mg",
        "frequency": "TWICE_DAILY",
        "reminder_times": ["08:30", "19:30"],
        "timezone": "UTC",
        "start_date": "2026-08-20",
        "end_date": None,
        "instructions": "Take 1 tablet with morning and evening meals.",
        "is_active": True,
        "user_confirmed": True,
        "document_id": "demo-doc-rx-metformin",
        "created_at": "2026-08-20T10:15:00Z",
        "updated_at": "2026-08-20T10:15:00Z",
    }

    # 2. Today's Reminders (Lisinopril: TAKEN, Metformin morning: TAKEN, Metformin evening: PENDING)
    rem_lis_id = f"demo-rem-{today_str}-lis"
    rem_met1_id = f"demo-rem-{today_str}-met1"
    rem_met2_id = f"demo-rem-{today_str}-met2"

    data["reminders"][rem_lis_id] = {
        "id": rem_lis_id,
        "schedule_id": sched_lisinopril_id,
        "user_id": user_id,
        "medication_name": "Lisinopril",
        "dosage": "10mg",
        "scheduled_for": f"{today_str}T08:00:00Z",
        "status": "TAKEN",
        "instructions": "Take 1 tablet every morning with water.",
        "notification_sent_at": f"{today_str}T08:00:00Z",
        "created_at": f"{today_str}T00:00:00Z",
    }

    data["reminders"][rem_met1_id] = {
        "id": rem_met1_id,
        "schedule_id": sched_metformin_id,
        "user_id": user_id,
        "medication_name": "Metformin",
        "dosage": "500mg",
        "scheduled_for": f"{today_str}T08:30:00Z",
        "status": "TAKEN",
        "instructions": "Take 1 tablet with breakfast.",
        "notification_sent_at": f"{today_str}T08:30:00Z",
        "created_at": f"{today_str}T00:00:00Z",
    }

    data["reminders"][rem_met2_id] = {
        "id": rem_met2_id,
        "schedule_id": sched_metformin_id,
        "user_id": user_id,
        "medication_name": "Metformin",
        "dosage": "500mg",
        "scheduled_for": f"{today_str}T19:30:00Z",
        "status": "PENDING",
        "instructions": "Take 1 tablet with dinner.",
        "notification_sent_at": None,
        "created_at": f"{today_str}T00:00:00Z",
    }

    # 3. Adherence Logs (Past 7 Days: High adherence ~92%)
    for i in range(1, 8):
        past_d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        log_lis_id = f"demo-log-{past_d}-lis"
        log_met1_id = f"demo-log-{past_d}-met1"
        log_met2_id = f"demo-log-{past_d}-met2"

        # Lisinopril always taken
        data["logs"][log_lis_id] = {
            "id": log_lis_id,
            "reminder_id": f"rem-{past_d}-lis",
            "user_id": user_id,
            "action": "TAKEN",
            "logged_at": f"{past_d}T08:05:00Z",
            "notes": "Dose confirmed on time",
        }
        # Metformin morning taken
        data["logs"][log_met1_id] = {
            "id": log_met1_id,
            "reminder_id": f"rem-{past_d}-met1",
            "user_id": user_id,
            "action": "TAKEN",
            "logged_at": f"{past_d}T08:40:00Z",
            "notes": "Taken with breakfast",
        }
        # Metformin evening (1 skipped on day 4, otherwise taken)
        action = "SKIPPED" if i == 4 else "TAKEN"
        data["logs"][log_met2_id] = {
            "id": log_met2_id,
            "reminder_id": f"rem-{past_d}-met2",
            "user_id": user_id,
            "action": action,
            "logged_at": f"{past_d}T19:45:00Z",
            "notes": "Late dinner" if action == "SKIPPED" else "Taken with dinner",
        }

    with open(reminders_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    logger.info("Successfully seeded demo medication schedules and adherence for %s", user_id)


def seed_demo_intelligence(user_id: str) -> None:
    """Seeds the Emergency Health Card and Family Profiles for Alex Morgan."""
    upload_dir = ensure_upload_dir()
    intel_file = upload_dir / "advanced_intelligence.json"

    data = {"emergency_cards": {}, "family_profiles": {}, "shares": {}}
    if intel_file.exists():
        try:
            with open(intel_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {"emergency_cards": {}, "family_profiles": {}, "shares": {}}

    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Emergency Card
    data["emergency_cards"][user_id] = {
        "id": "demo-card-alex-morgan",
        "user_id": user_id,
        "emergency_token": "emg_demo_alex_morgan",
        "emergency_contact_name": DEMO_EMERGENCY_CONTACT_NAME,
        "emergency_contact_phone": DEMO_EMERGENCY_CONTACT_PHONE,
        "emergency_contact_relation": DEMO_EMERGENCY_CONTACT_RELATION,
        "blood_group": DEMO_BLOOD_GROUP,
        "allergies": DEMO_ALLERGIES,
        "confirmed_medications": DEMO_MEDICATIONS,
        "critical_notes": DEMO_CRITICAL_NOTES,
        "is_active": True,
        "created_at": "2026-05-15T09:00:00Z",
        "updated_at": now_iso,
    }

    # 2. Family Profiles (Child & Elderly Parent)
    fam_taylor_id = "demo-family-taylor"
    fam_eleanor_id = "demo-family-eleanor"

    data["family_profiles"][fam_taylor_id] = {
        "id": fam_taylor_id,
        "account_owner_id": user_id,
        "full_name": "Taylor Morgan",
        "relationship": "Child",
        "date_of_birth": "2018-06-22",
        "gender": "Female",
        "created_at": "2026-06-01T10:00:00Z",
        "updated_at": "2026-06-01T10:00:00Z",
    }

    data["family_profiles"][fam_eleanor_id] = {
        "id": fam_eleanor_id,
        "account_owner_id": user_id,
        "full_name": "Eleanor Vance-Morgan",
        "relationship": "Parent",
        "date_of_birth": "1954-11-03",
        "gender": "Female",
        "created_at": "2026-06-01T10:05:00Z",
        "updated_at": "2026-06-01T10:05:00Z",
    }

    with open(intel_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    logger.info("Successfully seeded demo emergency card and family profiles for %s", user_id)


def seed_demo_assistant(user_id: str) -> None:
    """Seeds rich, realistic conversational interactions with document citations into the RAG store."""
    upload_dir = ensure_upload_dir()
    rag_file = upload_dir / "assistant_rag.json"

    data = {"conversations": {}, "messages": {}, "chunks": {}}
    if rag_file.exists():
        try:
            with open(rag_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {"conversations": {}, "messages": {}, "chunks": {}}

    conv1_id = "demo-conv-medication-review"
    conv2_id = "demo-conv-glucose-trends"

    # Conversation 1: Medication & Allergy Review
    data["conversations"][conv1_id] = {
        "id": conv1_id,
        "user_id": user_id,
        "title": "Current Medications & Allergy Consultation",
        "created_at": "2026-11-14T10:00:00Z",
        "updated_at": "2026-11-14T10:05:00Z",
    }

    data["messages"][f"{conv1_id}-msg-1"] = {
        "id": f"{conv1_id}-msg-1",
        "conversation_id": conv1_id,
        "role": "user",
        "content": "What are my current active medications and what were they prescribed for?",
        "citations": [],
        "created_at": "2026-11-14T10:00:00Z",
    }

    data["messages"][f"{conv1_id}-msg-2"] = {
        "id": f"{conv1_id}-msg-2",
        "conversation_id": conv1_id,
        "role": "assistant",
        "content": (
            "Based on your verified medical records, you have two active long-term prescriptions:\n\n"
            "1. **Lisinopril (10 mg tablet)**: Take 1 tablet orally once daily in the morning with water. "
            "Prescribed by **Dr. Robert Chen, MD** on May 15, 2026 for **Primary Essential Hypertension**.\n\n"
            "2. **Metformin ER (500 mg tablet)**: Take 1 tablet orally twice daily with morning and evening meals. "
            "Prescribed by **Dr. Sarah Lin, MD** on August 20, 2026 for **Impaired Fasting Glucose**.\n\n"
            "*(Note: You also completed an acute 10-day course of Amoxicillin 500mg in November 2026 for sinusitis).*"
        ),
        "citations": [
            {
                "document_id": "demo-doc-rx-lisinopril",
                "document_filename": "Prescription_Lisinopril_10mg.pdf",
                "document_date": "2026-05-15",
                "document_type": "prescription",
                "snippet": "Rx: Lisinopril 10 mg Oral Tablet | Sig: Take 1 tablet orally once daily every morning with water.",
                "relevance_score": 0.96,
            },
            {
                "document_id": "demo-doc-rx-metformin",
                "document_filename": "Prescription_Metformin_500mg.pdf",
                "document_date": "2026-08-20",
                "document_type": "prescription",
                "snippet": "Rx: Metformin HCl 500 mg Extended-Release | Sig: Take 1 tablet orally twice daily with meals.",
                "relevance_score": 0.95,
            },
        ],
        "created_at": "2026-11-14T10:00:05Z",
    }

    # Conversation 2: Biomarker & Trend Inquiries
    data["conversations"][conv2_id] = {
        "id": conv2_id,
        "user_id": user_id,
        "title": "Cholesterol & Blood Glucose 6-Month Progress",
        "created_at": "2026-11-15T14:30:00Z",
        "updated_at": "2026-11-15T14:35:00Z",
    }

    data["messages"][f"{conv2_id}-msg-1"] = {
        "id": f"{conv2_id}-msg-1",
        "conversation_id": conv2_id,
        "role": "user",
        "content": "How have my cholesterol and blood glucose levels trended between May and November 2026?",
        "citations": [],
        "created_at": "2026-11-15T14:30:00Z",
    }

    data["messages"][f"{conv2_id}-msg-2"] = {
        "id": f"{conv2_id}-msg-2",
        "conversation_id": conv2_id,
        "role": "assistant",
        "content": (
            "Reviewing your Quest Diagnostics laboratory panels from May 15, August 20, and November 12, 2026, "
            "both your lipid and glycemic biomarkers show significant clinical improvement:\n\n"
            "- **Total Cholesterol**: Reduced from **215 mg/dL** [High] in May down to **202 mg/dL** in August, and reached **188 mg/dL** [Normal] on November 12.\n"
            "- **LDL Cholesterol**: Dropped from **135 mg/dL** [High] to **124 mg/dL**, and reached **110 mg/dL** [Normal].\n"
            "- **HDL Cholesterol**: Improved progressively from **48 mg/dL** to **52 mg/dL**, reaching **55 mg/dL**.\n"
            "- **Fasting Blood Glucose**: Decreased from **110 mg/dL** [High] in May and **104 mg/dL** in August down to **92 mg/dL** [Normal] in November.\n"
            "- **Hemoglobin A1c**: Verified at **5.5%** [Normal] in your November follow-up panel."
        ),
        "citations": [
            {
                "document_id": "demo-doc-lab-lipid-may",
                "document_filename": "Lab_Report_Lipid_Panel_May2026.pdf",
                "document_date": "2026-05-15",
                "document_type": "lab_report",
                "snippet": "Total Cholesterol: 215 mg/dL [HIGH] | Fasting Glucose: 110 mg/dL [HIGH]",
                "relevance_score": 0.97,
            },
            {
                "document_id": "demo-doc-lab-panels-nov",
                "document_filename": "Lab_Report_Metabolic_FollowUp_Nov2026.pdf",
                "document_date": "2026-11-12",
                "document_type": "lab_report",
                "snippet": "Total Cholesterol: 188 mg/dL [NORMAL] | Fasting Glucose: 92 mg/dL [NORMAL] | HbA1c: 5.5%",
                "relevance_score": 0.98,
            },
        ],
        "created_at": "2026-11-15T14:30:05Z",
    }

    with open(rag_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    logger.info("Successfully seeded demo assistant conversations and citations for %s", user_id)


def ensure_all_demo_data_seeded(user_id: str = DEMO_USER_ID) -> None:
    """Master entry point to idempotently seed the full Alex Morgan dataset."""
    seed_demo_documents(user_id)
    seed_demo_reminders(user_id)
    seed_demo_intelligence(user_id)
    seed_demo_assistant(user_id)
