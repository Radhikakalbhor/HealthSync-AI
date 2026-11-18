# HealthSync AI — Security & Privacy Architecture Guide

## 1. Executive Summary & Security Principles
HealthSync AI is architected around defense-in-depth principles for Protected Health Information (PHI):
1. **Tenant Isolation**: Every clinical entity (documents, prescriptions, lab results, reminder schedules, chat histories, family members) is strictly partitioned by `user_id` / `auth.uid()`.
2. **Zero-Trust File Ingestion**: Uploaded files undergo strict magic-byte validation, extension whitelist matching, and executable signature blocking. Files are stored under random UUIDs, preventing path traversal.
3. **Stateless JWT Authorization**: API routes authenticate requests via cryptographic HMAC-SHA256 JWT tokens issued by Supabase Auth. Missing, invalid, or expired tokens are rejected before reaching business logic.
4. **Non-Diagnostic AI Guardrails**: AI models are instructed via deterministic zero-shot system prompts with temperature 0.05 to never diagnose diseases, invent prescriptions, or extrapolate clinical findings.
5. **Sanitized Audit Trail**: Sensitive tokens, passwords, and raw clinical text are purged prior to logging.

---

## 2. Authentication & Authorization Security

### 2.1 JWT Verification Strategy
- **HMAC SHA-256 (`HS256`)**: Tokens are signed using `SUPABASE_JWT_SECRET`.
- **Claims Validation**: Verifies signature, expiration (`exp`), and subject (`sub` UUID).
- **Session Expiration**: Expired tokens return `401 Unauthorized` with error code `UNAUTHORIZED`.
- **No Client Credential Storage**: Passwords are never stored or logged in plain text.

### 2.2 Role-Based and Ownership Enforcement
- Every protected API route depends on `get_current_user`.
- API endpoints never accept or trust `user_id` from query parameters or request payloads; identity is derived exclusively from the verified JWT payload.

---

## 3. Database Security & Row-Level Security (RLS)

All 17 PostgreSQL tables in Supabase have **Row-Level Security ENABLED**:
- `profiles`
- `medical_documents`
- `extracted_prescriptions`
- `extracted_medications`
- `extracted_lab_reports`
- `extracted_lab_results`
- `document_shares`
- `audit_logs`
- `medication_schedules`
- `medication_reminders`
- `medication_logs`
- `document_chunks`
- `chat_conversations`
- `chat_messages`
- `family_profiles`
- `emergency_cards`
- `shared_access_tokens`

### Policy Enforcement Mechanics
- **Owner Isolation**: `auth.uid() = user_id` ensures cross-tenant data leakage is mathematically impossible at the database engine level.
- **Controlled Sharing**: Documents shared via email (`document_shares`) are visible to recipient `auth.uid()` only when `is_revoked = false` and `expires_at > now()`.
- **Public Token Access**: `shared_access_tokens` and `emergency_cards` permit unauthenticated read-only access solely when queried with the exact 128-bit random token, when `is_active` is true and expiration has not passed.
- **Audit Immutability**: `UPDATE` and `DELETE` on `audit_logs` are revoked for all roles.

---

## 4. File Storage & Upload Security

### 4.1 Ingestion Gateways
- **MIME & Magic Byte Verification**:
  - PDF: `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`)
  - PNG: `\x89PNG\r\n\x1a\n`
  - JPEG: `\xff\xd8\xff`
- **Blocked Executables & Scripts**:
  - `MZ` (Windows PE executable / DLL)
  - `\x7fELF` (Linux ELF executable)
  - `#!` (Unix script shebang)
  - `<!DOCTYPE`, `<html`, `<svg` (HTML/SVG script injection vectors)
- **File Size Ceiling**: Hard cap enforced at 10 MB (`MAX_UPLOAD_SIZE_MB`).

### 4.2 Storage & Path Traversal Prevention
- Original filenames are sanitized with `sanitize_filename` (stripping directory separators and null bytes).
- Stored files are written to disk or bucket using UUID4 filenames: `<uuid4>.<extension>`. Internal filesystem paths are never exposed in API responses.
- Private Cloud Storage: Supabase bucket `medical-documents` is private. Downloads are delivered through time-limited signed URLs (default 1 hour).

---

## 5. Medical Document Sharing & QR Code Security

### 5.1 Temporary QR Sharing Tokens
- Tokens are generated using high-entropy random identifiers: `hst_<uuid4.hex>`.
- Configurable expiration from 1 hour to 168 hours (7 days maximum).
- Immediate patient revocation: `DELETE /api/v1/shares/{token}` marks token as revoked immediately.
- Strict Scope: Only documents explicitly selected by the patient during share link creation are queryable through that token.

### 5.2 Emergency Health Card Protocol
- Access token: `emg_<uuid4.hex>`.
- Exposes exclusively: Emergency contact name/phone/relation, confirmed allergies, confirmed active medications, blood group, and critical clinical notes.
- Underlying full documents, doctor consultation notes, and private files are NEVER exposed via emergency cards.
- Patient can toggle emergency card public accessibility off at any time.

---

## 6. Secrets & Environment Configuration Hygiene

- `.gitignore` explicitly blocks: `.env`, `.env.local`, `.env.*.local`, `.venv/`, `node_modules/`, `uploads/`.
- `backend/.env.example` and `frontend/.env.local.example` contain placeholder strings only (`your-anon-public-key`, `your-supabase-jwt-secret`, etc.).
- The codebase was thoroughly scanned: zero API keys, passwords, or service-role keys are hardcoded in source code or Git history.
- Audit logging purges metadata keys matching `password`, `token`, `secret`, `api_key`, or medical values.

---

## 7. AI Safety & Privacy Guardrails

- **Temperature 0.05**: Prevents creative hallucination or variation in medical entity extraction.
- **RAG Tenant Sandboxing**: Semantic search queries are strictly bounded to `user_id == auth.uid()`. Cross-tenant retrieval is impossible.
- **Verifiable Citations**: Every AI response based on medical records references the document filename, date, and verbatim snippet.
- **Missing Information Protocol**: If requested data does not exist in uploaded records, the assistant explicitly states it was not found, rather than guessing or providing generic clinical assumptions.
