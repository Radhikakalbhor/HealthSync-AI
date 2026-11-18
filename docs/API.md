# HealthSync AI – API Documentation

## Base URLs
- **Local Development**: `http://localhost:8000`
- **Interactive OpenAPI UI (Swagger)**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **OpenAPI Schema JSON**: `http://localhost:8000/openapi.json`

---

## ⚠️ Important Medical Disclaimer
All clinical endpoints return an explicit medical disclaimer:
> *"HealthSync AI organizes, retrieves, and explains information from existing medical records. It NEVER diagnoses diseases, recommends treatments, or prescribes medications. Always consult a licensed healthcare professional for clinical decisions."*

---

## 1. System & Health Endpoints

### 1.1 Root Service Information
- **Method**: `GET`
- **Path**: `/`
- **Auth Required**: No
- **Response**: `200 OK`
```json
{
  "name": "HealthSync AI",
  "version": "0.1.0",
  "status": "online",
  "docs": "/docs",
  "health": "/health",
  "api_v1": "/api/v1",
  "disclaimer": "..."
}
```

### 1.2 System Health Check
- **Method**: `GET`
- **Path**: `/health` (also accessible as `/api/v1/health`)
- **Auth Required**: No
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-11-16T01:10:00.123456Z",
  "uptime_seconds": 12.34
}
```

---

## 2. Authentication & User Profile Endpoints

All protected medical endpoints require the HTTP Header:
`Authorization: Bearer <access_token>`

### 2.1 User Registration
Registers a new user account with Supabase Auth and provisions a profile row.
- **Method**: `POST`
- **Path**: `/api/v1/auth/register`
- **Auth Required**: No
- **Request Body**: `application/json`
```json
{
  "email": "patient@healthsync.ai",
  "password": "SecurePassword123!",
  "full_name": "Jane Doe"
}
```
- **Response**: `201 Created`
```json
{
  "id": "c3d69b91-4e4b-4b13-9ecb-d10a95fae223",
  "email": "patient@healthsync.ai",
  "full_name": "Jane Doe",
  "created_at": "2026-11-16T01:15:00.000000Z"
}
```

### 2.2 User Login
Authenticates an existing user and returns a signed Supabase JWT access token.
- **Method**: `POST`
- **Path**: `/api/v1/auth/login`
- **Auth Required**: No
- **Request Body**: `application/json`
```json
{
  "email": "patient@healthsync.ai",
  "password": "SecurePassword123!"
}
```
- **Response**: `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "f0d1...",
  "user_id": "c3d69b91-4e4b-4b13-9ecb-d10a95fae223",
  "email": "patient@healthsync.ai"
}
```

### 2.3 User Logout
Signs out the user session and invalidates active authentication state.
- **Method**: `POST`
- **Path**: `/api/v1/auth/logout`
- **Auth Required**: Yes (`Bearer <token>`)
- **Response**: `200 OK`
```json
{
  "message": "Successfully logged out."
}
```

### 2.4 Get Current User Profile
Retrieves the profile information associated with the verified Bearer token.
- **Method**: `GET`
- **Path**: `/api/v1/auth/me`
- **Auth Required**: Yes (`Bearer <token>`)
- **Response**: `200 OK`
```json
{
  "id": "c3d69b91-4e4b-4b13-9ecb-d10a95fae223",
  "email": "patient@healthsync.ai",
  "full_name": "Jane Doe",
  "created_at": "2026-11-16T01:15:00.000000Z"
}
```

---

## 3. Medical Document Management Endpoints

All document endpoints enforce strict patient ownership and Row-Level Security checks.

### 3.1 Upload & Ingest Document
Uploads a medical document (PDF, PNG, JPG, JPEG), performs validation, triggers extraction, and persists entities.
- **Method**: `POST`
- **Path**: `/api/v1/documents/upload`
- **Auth Required**: Yes (`Bearer <token>`)
- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `file`: Binary file content (Max size: 10MB)
  - `document_type_hint` *(optional)*: e.g. `Prescription`, `Blood Test`
  - `enable_llm_extraction` *(optional, bool, default: true)*
- **Response**: `201 Created`
```json
{
  "document_id": "87bfff28-7931-4632-a94c-0daad75e3db6",
  "original_filename": "prescription_nov2026.pdf",
  "document_type": "prescription",
  "file_size": 245120,
  "status": "extracted",
  "upload_timestamp": "2026-11-16T01:10:05.123456Z",
  "extracted_data": {
    "patient_name": "Jane Doe",
    "doctor_name": "Dr. Sarah Smith",
    "clinic_name": "Metro Health Clinic",
    "prescription_date": "15/11/2026",
    "medications": [
      {
        "name": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "Three times daily",
        "duration": "7 days",
        "instructions": "Take after food with plenty of water"
      }
    ]
  },
  "confidence_score": 0.95,
  "confidence_source": "digital_pdf_stream",
  "needs_human_review": false,
  "verification_reasons": [],
  "disclaimer": "HealthSync AI organizes, retrieves, and explains information from existing medical records. It NEVER diagnoses diseases, recommends treatments, or prescribes medications. Always consult a licensed healthcare professional for clinical decisions."
}
```

### 3.2 List User Documents
Lists all medical documents owned by or shared with the authenticated user.
- **Method**: `GET`
- **Path**: `/api/v1/documents`
- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**:
  - `limit` *(int, default: 50)*
  - `offset` *(int, default: 0)*
- **Response**: `200 OK`
```json
{
  "total": 1,
  "documents": [
    {
      "id": "87bfff28-7931-4632-a94c-0daad75e3db6",
      "user_id": "c3d69b91-4e4b-4b13-9ecb-d10a95fae223",
      "filename": "prescription_nov2026.pdf",
      "document_type": "prescription",
      "file_size_bytes": 245120,
      "processing_status": "PROCESSED",
      "needs_human_review": false,
      "created_at": "2026-11-16T01:10:05.123456Z"
    }
  ]
}
```

### 3.3 Get Document Details
Retrieves details, raw text, and structured extraction for a specific document.
- **Method**: `GET`
- **Path**: `/api/v1/documents/{document_id}`
- **Auth Required**: Yes (`Bearer <token>`)
- **Response**: `200 OK`

### 3.4 Delete Document
Permanently deletes a document record, related extraction entities, and its cloud storage file.
- **Method**: `DELETE`
- **Path**: `/api/v1/documents/{document_id}`
- **Auth Required**: Yes (`Bearer <token>`)
- **Response**: `200 OK`
```json
{
  "message": "Document deleted successfully."
}
```

### 3.5 Generate Signed Download URL
Generates a time-limited signed URL to securely download the original document from private storage.
- **Method**: `GET`
- **Path**: `/api/v1/documents/{document_id}/download`
- **Auth Required**: Yes (`Bearer <token>`)
- **Response**: `200 OK`
```json
{
  "download_url": "https://your-project.supabase.co/storage/v1/object/sign/medical-documents/...",
  "expires_in_seconds": 3600
}
```

### 3.6 Get Processing Status
- **Method**: `GET`
- **Path**: `/api/v1/documents/{document_id}/status`
- **Auth Required**: Yes (`Bearer <token>`)
- **Response**: `200 OK`

### 3.7 Get Document Review Screen Data
Tailored response designed for human-in-the-loop review interfaces. Highlights fields requiring patient/provider confirmation, provides empirical OCR confidence scores, and maintains verbatim extracted OCR text.
- **Method**: `GET`
- **Path**: `/api/v1/documents/{document_id}/review`
- **Auth Required**: Yes (`Bearer <token>`)
- **Response**: `200 OK`

### 3.8 Share Document
Grants view or edit access on a specific document to another user by email.
- **Method**: `POST`
- **Path**: `/api/v1/documents/{document_id}/share`
- **Auth Required**: Yes (`Bearer <token>`)
- **Request Body**: `application/json`
```json
{
  "shared_with_email": "doctor@clinic.com",
  "permission_level": "VIEW",
  "expires_in_days": 7
}
```
- **Response**: `200 OK`
```json
{
  "share_id": "e2a1b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
  "document_id": "87bfff28-7931-4632-a94c-0daad75e3db6",
  "shared_with_email": "doctor@clinic.com",
  "permission_level": "VIEW",
  "expires_at": "2026-11-23T01:10:05.123456Z"
}
```

---

## 4. Smart Medication Reminders Endpoints

All reminder endpoints require the HTTP Header:
`Authorization: Bearer <access_token>`

### 4.1 Create Medication Schedule
Creates a recurring reminder routine. Requires `user_confirmed: true` before activating live reminders.
- **Method**: `POST`
- **Path**: `/api/v1/reminders/schedules`
- **Request Body**: `application/json`
```json
{
  "medication_name": "Amoxicillin",
  "dosage": "500mg",
  "frequency": "TWICE_DAILY",
  "reminder_times": ["08:00", "20:00"],
  "timezone": "UTC",
  "start_date": "2026-11-16",
  "instructions": "Take after meals",
  "user_confirmed": true
}
```
- **Response**: `201 Created`

### 4.2 List Medication Schedules
- **Method**: `GET`
- **Path**: `/api/v1/reminders/schedules?active_only=false`
- **Response**: `200 OK`

### 4.3 Get Today's Scheduled Reminders
Retrieves all dosage events scheduled for today with adherence status (`PENDING`, `TAKEN`, `SKIPPED`, `MISSED`).
- **Method**: `GET`
- **Path**: `/api/v1/reminders/today`
- **Response**: `200 OK`

### 4.4 Log Dose Action
Records adherence without altering medical prescription.
- **Method**: `POST`
- **Path**: `/api/v1/reminders/{reminder_id}/log`
- **Request Body**: `{"action": "TAKEN", "notes": "Taken on time"}`
- **Response**: `200 OK`

### 4.5 Weekly Adherence Statistics
- **Method**: `GET`
- **Path**: `/api/v1/reminders/adherence?days=7`
- **Response**: `200 OK`
```json
{
  "total_scheduled": 14,
  "total_taken": 13,
  "total_skipped": 1,
  "total_missed": 0,
  "adherence_percentage": 92.9,
  "streak_days": 6,
  "medical_safety_disclaimer": "..."
}
```

---

## 5. AI Medical Records Assistant Endpoints

All assistant endpoints require the HTTP Header:
`Authorization: Bearer <access_token>`

### 5.1 Create Conversation
- **Method**: `POST`
- **Path**: `/api/v1/assistant/conversations`
- **Request Body**: `{"title": "Prescription Review Query"}`
- **Response**: `201 Created`

### 5.2 List Conversations
- **Method**: `GET`
- **Path**: `/api/v1/assistant/conversations`
- **Response**: `200 OK`

### 5.3 Ask Question with Source Citations
Queries the patient's isolated medical documents using RAG.
- **Method**: `POST`
- **Path**: `/api/v1/assistant/conversations/{conversation_id}/messages`
- **Request Body**: `application/json`
```json
{
  "content": "What was my HbA1c value in my last laboratory report?"
}
```
- **Response**: `200 OK`
```json
{
  "id": "21e4a3b2-c1d0-4e9f-8a7b-6c5d4e3f2a1b",
  "conversation_id": "99f8e7d6-c5b4-4a3b-2c1d-0e9f8a7b6c5d",
  "role": "assistant",
  "content": "Based on your medical records in 'BloodTest_DiagnosticReport.pdf':\n\n• HbA1c: 5.6% (Reference: < 5.7%, Normal)",
  "citations": [
    {
      "document_id": "87bfff28-7931-4632-a94c-0daad75e3db6",
      "document_filename": "BloodTest_DiagnosticReport.pdf",
      "document_date": "15/11/2026",
      "document_type": "blood_test",
      "snippet": "HbA1c: 5.6% (Reference: < 5.7%, Normal)...",
      "relevance_score": 0.85
    }
  ],
  "disclaimer": "HealthSync AI explains information from your existing medical records for informational reference only. It NEVER diagnoses diseases, prescribes medicines, or recommends changes to your prescribed treatment."
}
```

---

## 6. Advanced Health Intelligence & Sharing (Phase 6)

### 6.1 Unified Medical Timeline
Aggregates all stored prescriptions, blood tests, radiology scans, and consultations into a chronological timeline.
- **Method**: `GET`
- **Path**: `/api/v1/timeline`
- **Query Parameters**:
  - `category` (optional: `prescription`, `blood_test`, `laboratory_report`, `imaging_report`)
  - `start_date` (optional: `YYYY-MM-DD`)
  - `end_date` (optional: `YYYY-MM-DD`)
  - `search` (optional keyword)
- **Response**: `200 OK` (`TimelineResponse`)

### 6.2 Biomarker Health Trends
Returns longitudinal biomarker measurements grouped strictly by compatible measurement units.
- **Method**: `GET`
- **Path**: `/api/v1/analytics/trends`
- **Query Parameters**: `test_name` (optional: `HbA1c`, `Glucose`, `Hemoglobin`, etc.)
- **Response**: `200 OK` (`HealthTrendsResponse`)

### 6.3 Doctor Visit Summary & PDF Export
Produces a patient-controlled medical summary report and downloadable binary PDF.
- **Preview**: `POST /api/v1/summary/preview` -> `200 OK` (`DoctorSummaryPreviewResponse`)
- **PDF Download**: `POST /api/v1/summary/generate-pdf` -> `200 OK` (`application/pdf` binary stream)

### 6.4 Secure Time-Limited QR Sharing
Creates unpredictable, expiring read-only share links (`hst_...`) with embedded QR codes.
- **Create**: `POST /api/v1/shares` -> `201 Created` (`ShareTokenResponse`)
- **List Active**: `GET /api/v1/shares` -> `200 OK`
- **Revoke**: `DELETE /api/v1/shares/{token}` -> `200 OK`
- **Public Read (No Auth)**: `GET /api/v1/shares/public/{token}` -> `200 OK` (`PublicShareAccessResponse`)

### 6.5 Emergency Health Card
Provisions life-saving patient vitals, emergency contacts, allergies, and confirmed medications.
- **Get**: `GET /api/v1/emergency` -> `200 OK` (`EmergencyCardResponse`)
- **Update**: `PUT /api/v1/emergency` -> `200 OK` (`EmergencyCardResponse`)
- **First Responder Public View (No Auth)**: `GET /api/v1/emergency/public/{emergency_token}` -> `200 OK`

### 6.6 Family Member Profiles
Enables logical separation of medical records for children, elderly parents, or dependents.
- **Create Profile**: `POST /api/v1/family` -> `201 Created` (`FamilyProfileResponse`)
- **List Profiles**: `GET /api/v1/family` -> `200 OK`
- **Delete Profile**: `DELETE /api/v1/family/{profile_id}` -> `200 OK`

### 6.7 Pre-Visit Doctor Briefing
Synthesizes clinical history and generates neutral, empowering suggested questions for doctor consultations.
- **Method**: `POST`
- **Path**: `/api/v1/briefing/generate`
- **Request Body**: `application/json`
```json
{
  "doctor_specialty": "Cardiology",
  "primary_concern": "Follow up on blood pressure medication"
}
```
- **Response**: `200 OK` (`PreVisitBriefingResponse`)

---

## 7. Standard Error Response Format
All errors return a structured JSON response:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation of error.",
    "details": null
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing, malformed, or expired Bearer authentication token. |
| `FORBIDDEN` | 403 | User does not have ownership or sharing permissions for this resource. |
| `UNSUPPORTED_FILE_TYPE` | 415 | File extension or magic bytes do not match supported formats (PDF, PNG, JPG, JPEG) or file is executable. |
| `FILE_TOO_LARGE` | 413 | Uploaded file exceeds configured limit (`MAX_UPLOAD_SIZE_MB`). |
| `ENTITY_NOT_FOUND` | 404 | Document with requested ID does not exist. |
| `OCR_DEPENDENCY_MISSING` | 503 | OCR needed for an image/scan, but Tesseract binary is not installed on the system. |
| `LLM_NOT_CONFIGURED` | 501 | LLM extraction was forced or requested, but `LLM_PROVIDER` or `LLM_API_KEY` is not set in `.env`. |
| `SUPABASE_NOT_CONFIGURED` | 503 | Supabase database or auth operations attempted while credentials are not configured in `.env`. |
| `REQUEST_VALIDATION_ERROR` | 422 | Input parameters failed Pydantic schema validation. |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled system exception (details sanitized). |
