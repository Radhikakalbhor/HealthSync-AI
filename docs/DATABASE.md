# HealthSync AI – Supabase Database Architecture & Security Guide

## 1. Overview

HealthSync AI utilizes **PostgreSQL via Supabase** as its primary relational database, vector index, and secure blob store. The architecture is engineered around the principle of strict data isolation: personal health information (PHI) is owned exclusively by the authenticated user, protected at the database engine level via **PostgreSQL Row-Level Security (RLS)**, and stored privately in **Supabase Storage**.

---

## 2. Complete Relational & Vector Schema Design (14 Tables)

```
                    ┌─────────────────┐
                    │   auth.users    │ (Supabase Managed)
                    └────────┬────────┘
                             │ 1:1
                             ▼
                    ┌─────────────────┐
                    │    profiles     │
                    └────────┬────────┘
                             │ 1:N
           ┌─────────────────┼─────────────────┬─────────────────┐
           │                 │                 │                 │
           ▼                 ▼                 ▼                 ▼
  ┌─────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │medical_documents│ │  medication_ │ │   document_  │ │     chat_    │
  └────────┬────────┘ │  schedules   │ │    chunks    │ │conversations │
           │          └──────┬───────┘ └──────────────┘ └──────┬───────┘
     ┌─────┴─────┐           │                                 │
     ▼           ▼           ▼                                 ▼
┌─────────┐ ┌─────────┐┌──────────────┐                  ┌──────────────┐
│extracted│ │extracted││  medication_ │                  │     chat_    │
│ prescr. │ │  labs   ││  reminders   │                  │   messages   │
└────┬────┘ └────┬────┘└──────┬───────┘                  └──────────────┘
     │           │            │
     ▼           ▼            ▼
┌─────────┐ ┌─────────┐┌──────────────┐
│extracted│ │extracted││  medication_ │
│  meds   │ │ results ││     logs     │
└─────────┘ └─────────┘└──────────────┘

┌─────────────────┐  ┌─────────────────┐
│ document_shares │  │   audit_logs    │ (Immutable system event log)
└─────────────────┘  └─────────────────┘
```

---

## 3. Core Tables Specifications

### 3.1 Document & Clinical Extraction (Phases 1–3)
- **`profiles`**: Linked to `auth.users`, provisions patient identity.
- **`medical_documents`**: Core ingested file metadata, storage paths, MIME types, processing status, and OCR confidence.
- **`extracted_prescriptions`** & **`extracted_medications`**: Prescribing doctor, clinic, issue date, and normalized drug dosage rosters.
- **`extracted_lab_reports`** & **`extracted_lab_results`**: Diagnostic facility, test date, and normalized biomarker analyte entries with reference ranges and abnormal flags (`NORMAL`, `HIGH`, `LOW`, `CRITICAL`).
- **`document_shares`**: Time-limited sharing authorizations with other registered emails.
- **`audit_logs`**: Append-only immutable compliance log with PHI sanitization.

### 3.2 Smart Medication Reminders (Phase 5)
#### `medication_schedules`
Stores patient-confirmed medication schedules.
- `id` (UUID PK)
- `user_id` (UUID FK -> profiles)
- `document_id` (UUID FK -> medical_documents, optional)
- `prescription_id` (UUID FK -> extracted_prescriptions, optional)
- `medication_name` (TEXT)
- `dosage` (TEXT)
- `frequency` (TEXT: `ONCE_DAILY`, `TWICE_DAILY`, `THREE_TIMES_DAILY`, `CUSTOM`)
- `reminder_times` (JSONB array: e.g. `["08:00", "20:00"]`)
- `timezone` (TEXT: default 'UTC')
- `start_date` (DATE)
- `end_date` (DATE optional)
- `instructions` (TEXT optional)
- `is_active` (BOOLEAN default true)
- `user_confirmed` (BOOLEAN default false — must be confirmed by patient to activate live reminders)

#### `medication_reminders`
Individual scheduled dose instances generated for daily adherence tracking.
- `id` (UUID PK)
- `schedule_id` (UUID FK -> medication_schedules ON DELETE CASCADE)
- `user_id` (UUID FK -> profiles)
- `scheduled_for` (TIMESTAMPTZ)
- `status` (TEXT: `PENDING`, `NOTIFIED`, `TAKEN`, `SKIPPED`, `MISSED`)
- `notification_sent_at` (TIMESTAMPTZ optional)
- Unique constraint on `(schedule_id, scheduled_for)` preventing duplicate doses.

#### `medication_logs`
Historical adherence log tracking taken, skipped, and missed doses.
- `id` (UUID PK)
- `schedule_id` (UUID FK)
- `reminder_id` (UUID FK optional)
- `user_id` (UUID FK)
- `action` (TEXT: `TAKEN`, `SKIPPED`, `MISSED`)
- `logged_at` (TIMESTAMPTZ)
- `notes` (TEXT optional)

### 3.3 AI Medical Records Assistant & RAG (Phase 5)
#### `document_chunks`
Text and structured entity chunks indexed for isolated semantic retrieval.
- `id` (UUID PK)
- `document_id` (UUID FK -> medical_documents ON DELETE CASCADE)
- `user_id` (UUID FK -> profiles)
- `chunk_index` (INT)
- `chunk_text` (TEXT)
- `metadata` (JSONB: `{ filename, doc_type, date, section }`)
- `embedding` (`vector(768)` when pgvector is enabled)

#### `chat_conversations`
Private conversational consultation sessions.
- `id` (UUID PK)
- `user_id` (UUID FK -> profiles)
- `title` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### `chat_messages`
Individual conversational turns with verifiable citations.
- `id` (UUID PK)
- `conversation_id` (UUID FK -> chat_conversations ON DELETE CASCADE)
- `user_id` (UUID FK -> profiles)
- `role` (TEXT: `user`, `assistant`, `system`)
- `content` (TEXT)
- `citations` (JSONB array of `{ document_id, filename, date, snippet }`)
- `created_at` (TIMESTAMPTZ)

### 3.4 Advanced Health Intelligence & Sharing (Phase 6)
#### `family_profiles`
Dependent and family member accounts managed by the primary patient.
- `id` (UUID PK)
- `account_owner_id` (UUID FK -> profiles ON DELETE CASCADE)
- `full_name` (TEXT)
- `relationship` (TEXT: `Spouse`, `Child`, `Parent`, `Sibling`, `Dependent`, `Other`)
- `date_of_birth` (DATE optional)
- `gender` (TEXT optional)
- `created_at` (TIMESTAMPTZ)
- *Note*: `medical_documents.family_member_id` foreign key optionally associates any uploaded record with a specific family profile.

#### `emergency_cards`
Physical/digital QR emergency badge configuration for first responders.
- `id` (UUID PK)
- `user_id` (UUID FK -> profiles ON DELETE CASCADE)
- `emergency_token` (TEXT UNIQUE)
- `emergency_contact_name` (TEXT optional)
- `emergency_contact_phone` (TEXT optional)
- `emergency_contact_relation` (TEXT optional)
- `blood_group` (TEXT optional: `O+`, `O-`, `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`)
- `allergies` (TEXT[] array)
- `confirmed_medications` (TEXT[] array)
- `critical_notes` (TEXT optional)
- `is_active` (BOOLEAN default true)

#### `shared_access_tokens`
Cryptographically unpredictable, expiring QR code share tokens (`hst_...`).
- `id` (UUID PK)
- `user_id` (UUID FK -> profiles ON DELETE CASCADE)
- `share_token` (TEXT UNIQUE)
- `document_ids` (UUID[] array)
- `recipient_label` (TEXT optional)
- `permission_level` (TEXT default `READ_ONLY`)
- `expires_at` (TIMESTAMPTZ)
- `is_revoked` (BOOLEAN default false)
- `view_count` (INTEGER default 0)
- `last_accessed_at` (TIMESTAMPTZ optional)

---

## 4. Row-Level Security (RLS) Policies

All 17 tables have **Row-Level Security ENABLED**.

1. **Patient Data Isolation**: `auth.uid() = user_id` enforces complete cross-tenant isolation.
2. **Cascading Child Protection**: All reminder doses, logs, document chunks, family members, and chat messages strictly verify that the record owner matches the authenticated session.
3. **Public Sharing Security**: `shared_access_tokens` and `emergency_cards` grant public read access ONLY when the record's exact unique token is presented, `is_active` is true, and the expiration date has not elapsed.
4. **Audit Immutability**: `audit_logs` permits insert and select by authenticated owners; updates and deletions are strictly rejected.

---

## 5. SQL Migrations Execution Order

Apply migrations in your Supabase SQL Editor:
1. `backend/migrations/001_initial_schema.sql` (Tables, profiles, documents, extractions)
2. `backend/migrations/002_row_level_security.sql` (Core RLS policies)
3. `backend/migrations/003_medication_reminders.sql` (Schedules, doses, adherence logs)
4. `backend/migrations/004_ai_assistant_rag.sql` (pgvector, document chunks, chat conversations, messages)
5. `backend/migrations/005_advanced_intelligence.sql` (Family profiles, emergency cards, QR access tokens, public RLS)
