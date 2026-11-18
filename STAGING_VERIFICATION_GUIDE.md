# HealthSync AI — Isolated Staging Migration, Testing & Verification Protocol

> **SAFETY NOTICE: ISOLATED STAGING ENVIRONMENT ONLY**
> - **NEVER** apply this procedure to the production Supabase database.
> - **NEVER** mix production credentials (`.env`) with staging credentials.
> - Use only synthetic/mock patient test data.

---

## 1. Prerequisites: Creating the Isolated Staging Supabase Project

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project** and configure:
   - **Name**: `healthsync-ai-staging`
   - **Database Password**: Generate a secure password and store it in your password manager.
   - **Region**: Choose the same region as your development host.
3. Once the database is provisioned, navigate to **Project Settings** -> **API**:
   - Copy `Project URL` -> `SUPABASE_URL`
   - Copy `anon / public` key -> `SUPABASE_KEY`
   - Copy `service_role / secret` key -> `SUPABASE_SERVICE_ROLE_KEY`
   - Copy `JWT Secret` -> `SUPABASE_JWT_SECRET`
4. Navigate to **Storage** in Supabase and create a new bucket:
   - **Bucket Name**: `medical-documents`
   - **Public bucket**: `Off` (Private, authenticated access only)

---

## 2. Setting Up Staging Configuration Without Overwriting Existing Files

> [!IMPORTANT]
> **Zero File Overwrites**: Do **NOT** rename, modify, or delete your existing `backend/.env` or `frontend/.env.local`. HealthSync AI supports explicit environment isolation via environment flags and dedicated `.env.staging` files.

### 2.1 Backend Staging Configuration
Create `backend/.env.staging` by copying the provided template:
```powershell
Copy-Item "backend/.env.staging.example" "backend/.env.staging"
```
Open `backend/.env.staging` and fill in your dedicated staging Supabase project credentials. Your existing `backend/.env` remains untouched and active for default operations.

### 2.2 Frontend Staging Configuration
Create `frontend/.env.staging` by copying the template:
```powershell
Copy-Item "frontend/.env.staging.example" "frontend/.env.staging"
```
Your existing `frontend/.env.local` remains untouched.

---

## 3. How to Start Backend and Frontend in Staging Mode (PowerShell)

### 3.1 Start Backend in Staging Mode
In PowerShell, set the environment selector before launching uvicorn:
```powershell
$env:HEALTHSYNC_ENV = "staging"
python -m uvicorn backend.main:app --port 8000 --reload
```
*Alternatively, you can provide an exact custom file path:*
```powershell
$env:HEALTHSYNC_ENV_FILE = "backend/.env.staging"
python -m uvicorn backend.main:app --port 8000 --reload
```
*Startup Safety Guarantee*:
If `HEALTHSYNC_ENV = "staging"` is set and `backend/.env.staging` is missing, or contains placeholder values (e.g. `<staging-project-ref>`), the application will immediately abort startup with a descriptive `STAGING CONFIGURATION ERROR` rather than silently reading production credentials.

To return to default/development mode:
```powershell
$env:HEALTHSYNC_ENV = $null
$env:HEALTHSYNC_ENV_FILE = $null
python -m uvicorn backend.main:app --port 8000 --reload
```

### 3.2 Start Frontend in Staging Mode
In a separate PowerShell terminal:
```powershell
cd frontend
$env:NODE_ENV = "development"
npm run dev
```
*(If running a dedicated build against a remote staging API URL, update `NEXT_PUBLIC_API_URL` in `frontend/.env.staging`)*

---

## 4. Step-by-Step Staging Migration Protocol

Open the **SQL Editor** in your `healthsync-ai-staging` Supabase Dashboard.

### Step 3.1: Apply Baseline Migrations 001–006 in Exact Sequence
Execute each file sequentially:
1. `backend/migrations/001_initial_schema.sql` (Creates core tables: `profiles`, `medical_documents`, `extracted_prescriptions`, `extracted_medications`, `extracted_lab_reports`, `extracted_lab_results`, `audit_logs`)
2. `backend/migrations/002_row_level_security.sql` (Enables RLS and basic tenant isolation)
3. `backend/migrations/003_medication_reminders.sql` (Creates medication schedules, logs, reminders)
4. `backend/migrations/004_ai_assistant_rag.sql` (Creates document chunking and vector index)
5. `backend/migrations/005_advanced_intelligence.sql` (Creates emergency cards, family profiles, shared access tokens)
6. `backend/migrations/006_table_privileges.sql` (Applies strict least-privilege table & routine DAC grants)

### Step 3.2: Verify Baseline Integrity
Execute `backend/migrations/verify_all_migrations.sql` in the SQL Editor. Confirm that all 17 tables and expected baseline views pass with zero errors.

### Step 3.3: Apply Migration 007
Execute `backend/migrations/007_unified_extraction_result.sql`:
- Preflight collision checks run.
- `_migration_007_manifest` is created and self-tracked.
- `profiles` columns (`role`, `clinician_approval_status`, `license_number`, `license_jurisdiction`) and self-promotion trigger are added.
- `medical_documents` columns (`extraction_result`, `user_reviewed`, `clinician_verified`, `verified_by_user_id`, `verified_by_clinician_snapshot`) and check constraints are added.
- `document_review_history` table is created.
- Stored procedures `_sync_document_relational_projections`, `save_document_extraction_atomic`, `save_document_patient_review_atomic`, and `verify_document_as_clinician_atomic` are deployed.

### Step 3.4: Test Rollback & Re-application (Rollback Safety Test)
1. Execute `backend/migrations/007_unified_extraction_result_rollback.sql`.
   - Verify that all Migration 007 objects are dropped without using `CASCADE`.
   - Verify that baseline tables (`profiles`, `medical_documents`, `extracted_prescriptions`) remain intact.
   - Verify that `_migration_007_manifest` is cleanly removed.
2. Re-apply `backend/migrations/007_unified_extraction_result.sql`.
   - Confirm that re-application succeeds with zero collision errors.

---

## 4. End-to-End Staging Feature Verification Protocol

With backend running against staging (`uvicorn backend.app.main:app --port 8000`) and frontend running (`npm run dev`):

### Verification 1: Patient Document Upload & Extraction
1. Register synthetic patient `patient_test@healthsync.ai`.
2. Upload synthetic prescription PDF.
3. Trigger extraction:
   - Verify document status moves from `uploaded` to `extracted`.
   - Verify `medical_documents.extraction_result` contains structured JSONB.
   - Verify `extracted_prescriptions` and `extracted_medications` contain synchronized projection rows.
   - Verify `raw_text` contains verbatim OCR text.

### Verification 2: Patient Review and Correction
1. Navigate to `/documents/[id]/review` as `patient_test@healthsync.ai`.
2. Edit medication dosage (e.g. change 500mg to 250mg) and click **Confirm & Save Corrections**.
3. Verify database state:
   - `user_reviewed` is `TRUE`.
   - `clinician_verified` remains `FALSE` (no spoofing).
   - `extracted_medications.dosage` is updated to `250mg`.
   - `document_review_history` contains a new row with `review_type = 'patient_correction'` and 3-way diff showing `modified.dosage`.

### Verification 3: Admin Clinician Approval Workflow
1. Register synthetic clinician user `dr_carter@healthsync.ai`. Initial state is `role = 'patient'`, `clinician_approval_status = 'none'`.
2. Attempt self-approval via API: verify HTTP 400 rejection (`cannot approve their own`).
3. Call `POST /api/v1/auth/admin/clinicians/approve` using admin credentials:
   ```json
   {
     "clinician_user_id": "<dr_carter_uuid>",
     "action": "approve",
     "license_number": "MED-CAL-889921",
     "license_jurisdiction": "CA"
   }
   ```
4. Verify `profiles` row updated: `role = 'clinician'`, `clinician_approval_status = 'approved'`.
5. Verify `audit_logs` records the administrative approval.

### Verification 4: Clinician Review & Verification Workflow
1. Log in to frontend as `dr_carter@healthsync.ai`.
2. Open patient's document review page `/documents/[id]/review`.
3. Verify that the **Clinician Sign & Verify** button is visibly rendered.
4. Click **Clinician Sign & Verify**, enter verification notes, and submit.
5. Verify database state:
   - `clinician_verified = TRUE`.
   - `clinician_verified_at` is set.
   - `verified_by_user_id` is set to Dr. Carter's UUID.
   - `verified_by_clinician_snapshot` contains Dr. Carter's name, license number, and jurisdiction.
   - `document_review_history` contains `review_type = 'clinician_verification'`.

### Verification 5: Non-Medical Document Quarantine
1. Upload synthetic resume or invoice.
2. Run extraction:
   - Verify `document_type = 'non_medical'` and `status = 'unsupported'`.
   - Verify `extraction_result` is strictly `NULL`.
   - Verify zero rows inserted into `extracted_prescriptions` or `extracted_lab_reports`.
   - Attempt clinical verification: verify HTTP 400 rejection (`Document type non_medical is not eligible for clinical verification`).

---

## 6. Alternative: Zero-Quota Local Database Verification (No Docker or Hosted Project Needed)

When hosted Supabase project limits are reached and Docker Desktop is unavailable, you can test the migration and rollback scripts against your local PostgreSQL 18 instance (`C:\Program Files\PostgreSQL\18\bin`) using the automated test runner:

```powershell
# In PowerShell:
.\run_local_db_tests.ps1
```

### Safety & Isolation Guarantees:
- **Zero Remote Calls**: Never connects to hosted Supabase (hard-restricted to `127.0.0.1`).
- **Disposable Database**: Targets strictly `healthsync_local_test`; protects system databases (`postgres`, `template0`, `template1`).
- **Canonical Sequence**: Applies migrations in strict order: `001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007`.
- **pgvector Testing Isolation**: Uses `backend/scripts/004_ai_assistant_rag_local_compat.sql` to provision non-vector tables, RLS, and triggers without requiring the compiled C `vector.dll`. Zero system catalog modifications.
- **Manifest Auditing**: Verifies `_migration_007_manifest` registers all objects and cleanly unregisters them upon rollback without `CASCADE`.
- **Invariance Check**: Verifies table-level `UPDATE` permission on `profiles` is restored to `authenticated`.
- **Immediate Failure Halting**: Checks `$LASTEXITCODE` after every native command.
- **Zero Overwrites**: Existing `backend/.env` and `frontend/.env.local` files are never touched.

### Local Testing Limitations vs. Real Supabase Stack:
1. **pgvector RAG Similarity**: Vector cosine distance `<=>` and HNSW index traversal are not tested on vanilla PostgreSQL without the pgvector binary.
2. **GoTrue Auth Service**: User registration and JWT signing are mocked via session configuration rather than the live GoTrue identity engine.
3. **Storage & Realtime**: S3 storage buckets and Realtime WebSocket subscriptions are Supabase cloud/Docker features and are not part of local PostgreSQL DDL testing.

