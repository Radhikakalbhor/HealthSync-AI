# HealthSync AI – System Architecture

## 1. Overview
**HealthSync AI** is a personal medical record and prescription manager built to help patients digitize, organize, and query their health records.

> **CRITICAL MEDICAL DISCLAIMER**:
> HealthSync AI **NEVER** provides medical diagnoses, treatment recommendations, or drug prescriptions. It functions solely as an intelligent organizer, retrieval engine, and simplifier of existing patient-supplied medical documentation.

---

## 2. Comprehensive System Architecture (Phase 5)

```
                                  [Patient / Next.js 15 Client UI]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │ HTTP/REST + Bearer JWT Token             │
                       ▼                                           ▼
             [FastAPI Backend Core]                     [Supabase Auth Service]
             ├── Auth & JWT Verification                ├── User Sign Up & Login
             ├── File Security & Validation             └── Token Issuance & Refresh
             ├── Pipeline Coordinator                              │
             ├── Reminder Scheduling Engine                        │
             ├── RAG Citation Engine                               │
             └── Audit Logger                                      │
                       │                                           │
       ┌───────────────┼────────────────────────┐                  │
       ▼               ▼                        ▼                  ▼
[PyMuPDF / OCR]   [Gemini Multimodal]    [Supabase DB / RLS]   [Private Storage]
(Text Extraction) (Vision Entity Engine) (PostgreSQL 15+)      (medical-documents)
                                         ├── profiles          └── {user_id}/{doc_id}/
                                         ├── medical_documents
                                         ├── extracted_prescriptions
                                         ├── extracted_medications
                                         ├── extracted_lab_reports
                                         ├── extracted_lab_results
                                         ├── medication_schedules
                                         ├── medication_reminders
                                         ├── medication_logs
                                         ├── document_chunks
                                         ├── chat_conversations
                                         ├── chat_messages
                                         ├── document_shares
                                         └── audit_logs
```

---

## 3. Ingestion & AI Understanding Pipeline

```
[Uploaded Document: PDF / PNG / JPG / JPEG]
                    │
                    ▼
       [File Security & Validation]
       ├── Magic byte signature inspection (%PDF-, PNG, JPEG)
       ├── Extension & MIME type verification
       ├── File size limit enforcement (max 10MB)
       └── UUID4 storage filename generation (No internal filesystem paths exposed)
                    │
                    ▼
         [File Storage: Supabase Private Storage / backend/uploads/]
                    │
                    ▼
            [Text Extraction Pipeline]
            ┌───────────────────────────────────────────────┐
            │ Digital PDF with embedded text?               │
            │  ├─► YES: PyMuPDF Direct Extraction           │ (100% fidelity, 0 noise)
            │  └─► NO (Scanned PDF or Image):               │
            │       Render to 300 DPI, Pillow Preprocess,   │
            │       and Tesseract OCR 5.4.0                 │ (Calibrated word-level confidence)
            └───────────────────────────────────────────────┘
                    │
                    ▼
          [Document Classification]
          ├── Deterministic keyword & regex scoring engine
          └── Categories: Prescription, Blood Test, Lab Report,
              Imaging Report, Discharge Summary, Consultation, Other (strict fallback)
                    │
                    ▼
         [Structured Medical Entity Extraction]
         ┌────────────────────────────────────────────────────────┐
         │ Vision LLM Configured (LLM_PROVIDER & API Key)?        │
         │  ├─► YES: Multimodal Gemini Vision Extraction          │
         │  │        (Deciphers handwriting & laboratory tables) │
         │  └─► NO:  Deterministic Regex Parser                   │
         │           (Unknown fields set strictly to null)        │
         └────────────────────────────────────────────────────────┘
                    │
                    ▼
        [Confidence & Verification Evaluation]
        ├── Empirical OCR word-level confidence
        ├── Discrepancy & readability checking
        └── Flags ambiguous fields for human-in-the-loop review
                    │
                    ▼
           [Pydantic v2 Validation]
           ├── PrescriptionData (medications, dosages, frequencies, instructions)
           ├── LabReportData (biomarkers, test results, reference intervals, flags)
           └── ImagingReportData (modality, findings, impression)
                    │
                    ▼
       [Supabase Relational Persistence]
       ├── Persist parent `medical_documents` record
       ├── Relational child insert into `extracted_prescriptions` & `extracted_medications`
       ├── Relational child insert into `extracted_lab_reports` & `extracted_lab_results`
       └── Immutable append-only audit event in `audit_logs`
```

---

## 4. Smart Medication Reminders Architecture

1. **User Confirmation Safeguard**: Reminders are never automatically activated from unverified prescription OCR text. Explicit patient confirmation (`user_confirmed=True`) is required.
2. **Timezone Awareness**: Schedules preserve the patient's local timezone (e.g. `America/New_York`, `UTC`), converting daily doses accurately to UTC for database storage.
3. **Dose Generation & Duplicate Prevention**:
   - Doses are generated for active dates.
   - Unique constraints on `(schedule_id, scheduled_for)` and in-memory tracking prevent duplicate alerts.
   - `notification_sent_at` ensures each dose triggers at most once.
4. **Adherence Logging**: Patients record doses as `TAKEN` or `SKIPPED`. The system computes adherence percentages and longitudinal streaks.
5. **Medical Safety Guarantee**: HealthSync AI never advises doubling missed doses or altering prescriptions.

---

## 5. AI Medical Records Assistant & RAG Pipeline

```
[Patient Natural Language Query]
               │
               ▼
 [Scoped Document Chunk Search]
 ├── Filter strictly by: auth.uid() == user_id (100% Tenant Isolation)
 ├── Token overlap & relevance scoring
 └── Chunk Context Assembly
               │
               ▼
 [Clinical Safety Prompt Injection]
 ├── Rule 1: NEVER diagnose diseases
 ├── Rule 2: NEVER prescribe drugs or change dosages
 ├── Rule 3: ONLY state facts from provided excerpts
 └── Rule 4: If information missing, explicitly report "Not found in records"
               │
               ▼
 [Gemini Multimodal / Deterministic Synthesizer]
               │
               ▼
 [Response with Verifiable Citations]
 ├── Document ID & Original Filename
 ├── Source Document Date
 ├── Verbatim Excerpt Snippet
 └── Direct Link to Document Review Screen
```

---

## 6. Advanced Health Intelligence Architecture (Phase 6)

```
                       [Advanced Health Intelligence Services]
                                          │
       ┌──────────────────┬───────────────┴───────────────┬──────────────────┐
       ▼                  ▼                               ▼                  ▼
[Unified Timeline] [Biomarker Analytics]          [Doctor Summary & PDF] [Emergency Card & QR]
 ├── Aggregation    ├── Longitudinal tracking      ├── Active vs Past Meds ├── Vital contacts
 ├── Date & Cat.    ├── Strict Unit Grouping       ├── Lab Overview        ├── Allergies & Vitals
 │   Filtering      │   (Never compare mg/dL       ├── PyMuPDF Binary      ├── Expiring Tokens
 └── Source Links   │    with mmol/L)              │   PDF Generation      └── Public Responder
                    └── Reference Ranges           └── Neutral Briefing        Badge Protocol
```

### 6.1 Biomarker Unit Safety Engine
To prevent dangerous clinical false equivalences, the analytics engine strictly segments lab series by `(test_name, unit)` tuples. For example, `Blood Glucose (mg/dL)` is strictly never merged or averaged with `Blood Glucose (mmol/L)`.

### 6.2 PyMuPDF Medical Document Generation
The Doctor Visit Summary generates genuine downloadable binary PDFs using PyMuPDF (`pymupdf`), featuring:
- Standardized medical header with patient name and generation timestamp.
- Tabular distinction between active medications (last 30 days) and previous prescriptions.
- Out-of-range lab result highlighting.
- Verifiable index of source document citations.
- Non-diagnostic legal safety disclaimer.

### 6.3 Secure QR Sharing & Emergency Access
- **Cryptographic Share Tokens**: Generated using `hst_` + 128-bit UUID entropy, with configurable expiration (1-168 hours) and immediate patient revocation.
- **Emergency Responder View**: `emg_` tokens expose only patient-designated life-saving information (blood group, allergies, confirmed medications, contact phone) without requiring credentials or exposing underlying full documents.

---

## 7. Security, Isolation & Row-Level Security (RLS)

- **PostgreSQL Row-Level Security**: Enabled across all 17 tables. Every medical document, prescription, lab test, reminder schedule, family profile, and chat conversation enforces `auth.uid() = user_id`.
- **Private Blob Storage**: Original records reside in private encrypted buckets. Downloads require short-lived signed URLs.
- **Audit Immutability**: All sensitive operations are logged to an append-only audit log with Protected Health Information (PHI) and authentication credentials stripped.
