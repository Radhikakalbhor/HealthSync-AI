-- ==============================================================================
-- HealthSync AI — Migration 006: Strict Least-Privilege Table & Routine Grants
-- Target: PostgreSQL / Supabase
--
-- PURPOSE:
-- Resolves PostgreSQL error 42501 (insufficient_privilege) during PostgREST
-- operations by granting precise Discretionary Access Control (DAC) permissions
-- to Supabase database roles (anon, authenticated, service_role).
--
-- LEAST-PRIVILEGE DESIGN PRINCIPLES:
-- 1. Schema Scope: Grants USAGE on schema public to enable PostgREST routing.
-- 2. Enumerated Access: Specific grants and revokes on the 17 HealthSync AI tables;
--    no blanket privileges or revokes across unrelated public-schema tables.
-- 3. Anonymous Protection: Zero direct table access for anon/PUBLIC on HealthSync AI
--    tables. Only EXECUTE on the 3 public token RPCs (emergency card, public share,
--    shared docs).
-- 4. Authenticated Scoping:
--    - Full CRUD only on personal medical data where user owns rows (guarded by RLS).
--    - document_chunks: SELECT only (ingestion/vectorization restricted to service_role).
--    - audit_logs: SELECT only (backend service_role performs trusted audit logging).
--    - medication_logs: SELECT, INSERT only (immutable dose adherence records).
--    - chat_messages: SELECT, INSERT, DELETE only (messages cannot be edited).
--    - profiles: SELECT, UPDATE only (creation handled by signup trigger/webhook).
-- 5. No Sequences for Authenticated: All 17 tables use UUID primary keys with
--    gen_random_uuid(); zero sequence privileges required or granted.
-- 6. Default Privileges: Scoped strictly to service_role for future tables created
--    by the executing role.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Usage Grants (PostgREST Routing Requirement)
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Anonymous & Public Protection (Zero Direct Medical Data Access)
-- ------------------------------------------------------------------------------
-- Explicitly revoke all privileges on the 17 HealthSync AI tables from anon and PUBLIC.
-- Unrelated tables in public schema remain unaffected.
REVOKE ALL PRIVILEGES ON
    public.profiles,
    public.medical_documents,
    public.extracted_prescriptions,
    public.extracted_medications,
    public.extracted_lab_reports,
    public.extracted_lab_results,
    public.document_shares,
    public.audit_logs,
    public.medication_schedules,
    public.medication_reminders,
    public.medication_logs,
    public.document_chunks,
    public.chat_conversations,
    public.chat_messages,
    public.family_profiles,
    public.emergency_cards,
    public.shared_access_tokens
FROM anon, PUBLIC;

-- Explicitly permit anon to execute ONLY the 3 public verification RPC functions
REVOKE ALL ON FUNCTION public.get_emergency_card_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_emergency_card_by_token(TEXT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_public_share_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_share_by_token(TEXT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_shared_documents_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_documents_by_token(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Service Role Grants (Trusted Backend Administrator)
-- ------------------------------------------------------------------------------
-- Scoped explicitly to the 17 HealthSync AI tables rather than blanket schema privileges.
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.profiles,
    public.medical_documents,
    public.extracted_prescriptions,
    public.extracted_medications,
    public.extracted_lab_reports,
    public.extracted_lab_results,
    public.document_shares,
    public.audit_logs,
    public.medication_schedules,
    public.medication_reminders,
    public.medication_logs,
    public.document_chunks,
    public.chat_conversations,
    public.chat_messages,
    public.family_profiles,
    public.emergency_cards,
    public.shared_access_tokens
TO service_role;

-- ------------------------------------------------------------------------------
-- 4. Authenticated Role Grants (Registered Patients & Collaborators)
-- ------------------------------------------------------------------------------

-- Profiles: Patients read and update their own profile (creation via trigger)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Medical Documents & Clinical Entities: Full lifecycle managed by patient
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extracted_prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extracted_medications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extracted_lab_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extracted_lab_results TO authenticated;

-- Document Sharing: Managed by patient and recipients
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_shares TO authenticated;

-- Medication Management: Schedules and active reminders
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_reminders TO authenticated;

-- Family Profiles: Managed by account owner
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_profiles TO authenticated;

-- Emergency Cards & Access Tokens: Managed by patient
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_access_tokens TO authenticated;

-- Chat Consultations: Conversations full lifecycle; Messages immutable (no UPDATE)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;

-- Document Chunks: Scoped SELECT only for citations/search (ingestion restricted to service_role)
GRANT SELECT ON public.document_chunks TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.document_chunks FROM authenticated;

-- ------------------------------------------------------------------------------
-- 5. Immutable Log Tables Hardening
-- ------------------------------------------------------------------------------

-- Medication Logs: Patients can read history and record dose actions (strictly append-only)
GRANT SELECT, INSERT ON public.medication_logs TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.medication_logs FROM authenticated, anon, PUBLIC;

-- Audit Logs: Trusted backend inserts logs via service_role; authenticated can only view history
GRANT SELECT ON public.audit_logs TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated, anon, PUBLIC;

-- ------------------------------------------------------------------------------
-- 6. Sequences & Default Privileges
-- ------------------------------------------------------------------------------
-- All 17 tables use UUID primary keys (gen_random_uuid()); zero sequence grants
-- are given to authenticated or anon.

-- NOTE ON DEFAULT PRIVILEGES:
-- In PostgreSQL, ALTER DEFAULT PRIVILEGES applies strictly to future objects created
-- by the current executing database role (typically 'postgres' in Supabase environments).
-- It does NOT affect existing objects, nor does it apply to objects created by any other
-- database owner/role unless explicitly configured via FOR ROLE <creator_role>.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
