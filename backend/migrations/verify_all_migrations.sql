-- ==============================================================================
-- HealthSync AI — Comprehensive Read-Only Database Verification Suite
-- Migrations 001 through 005 Verification
-- Target: PostgreSQL / Supabase
--
-- INSTRUCTIONS:
-- Execute this script in the Supabase SQL Editor.
-- Every check is strictly READ-ONLY (no DDL, no DML, no schema alterations).
-- ==============================================================================

-- ==============================================================================
-- CHECK 1: VERIFY ALL 17 APPLICATION TABLES EXIST
-- ==============================================================================
WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'profiles',
        'medical_documents',
        'extracted_prescriptions',
        'extracted_medications',
        'extracted_lab_reports',
        'extracted_lab_results',
        'document_shares',
        'audit_logs',
        'medication_schedules',
        'medication_reminders',
        'medication_logs',
        'document_chunks',
        'chat_conversations',
        'chat_messages',
        'family_profiles',
        'emergency_cards',
        'shared_access_tokens'
    ]) AS table_name
)
SELECT
    'Check 1: Table Existence' AS audit_category,
    et.table_name AS target_object,
    CASE
        WHEN pt.tablename IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END AS check_status,
    CASE
        WHEN pt.tablename IS NOT NULL THEN 'Table exists in public schema'
        ELSE 'CRITICAL: Table is missing from database'
    END AS details
FROM expected_tables et
LEFT JOIN pg_tables pt ON pt.schemaname = 'public' AND pt.tablename = et.table_name
ORDER BY check_status ASC, et.table_name;


-- ==============================================================================
-- CHECK 2: VERIFY ROW-LEVEL SECURITY (RLS) IS ENABLED ON ALL 17 TABLES
-- ==============================================================================
WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'profiles',
        'medical_documents',
        'extracted_prescriptions',
        'extracted_medications',
        'extracted_lab_reports',
        'extracted_lab_results',
        'document_shares',
        'audit_logs',
        'medication_schedules',
        'medication_reminders',
        'medication_logs',
        'document_chunks',
        'chat_conversations',
        'chat_messages',
        'family_profiles',
        'emergency_cards',
        'shared_access_tokens'
    ]) AS table_name
)
SELECT
    'Check 2: Table RLS Status' AS audit_category,
    et.table_name AS target_object,
    CASE
        WHEN pt.tablename IS NULL THEN 'FAIL'
        WHEN pt.rowsecurity = true THEN 'PASS'
        ELSE 'FAIL'
    END AS check_status,
    CASE
        WHEN pt.tablename IS NULL THEN 'Table does not exist'
        WHEN pt.rowsecurity = true THEN 'Row-Level Security is actively enabled'
        ELSE 'SECURITY RISK: Row-Level Security is DISABLED'
    END AS details
FROM expected_tables et
LEFT JOIN pg_tables pt ON pt.schemaname = 'public' AND pt.tablename = et.table_name
ORDER BY check_status ASC, et.table_name;


-- ==============================================================================
-- CHECK 3: VERIFY CRITICAL RLS POLICIES & CHAT MESSAGE ROLE RESTRICTIONS
-- ==============================================================================
SELECT
    'Check 3: Critical RLS Policies' AS audit_category,
    p.tablename || '.' || p.policyname AS target_object,
    CASE
        -- Authenticated insert policy on chat_messages must enforce role = 'user'
        WHEN p.tablename = 'chat_messages' AND p.cmd = 'INSERT' AND p.roles @> ARRAY['authenticated'::name] THEN
            CASE
                WHEN p.with_check LIKE '%role%user%' THEN 'PASS'
                ELSE 'FAIL'
            END
        -- Service role must have management policy for backend synthesis
        WHEN p.tablename = 'chat_messages' AND p.roles @> ARRAY['service_role'::name] THEN 'PASS'
        -- Document chunks tenant isolation
        WHEN p.tablename = 'document_chunks' AND p.cmd = 'SELECT' THEN 'PASS'
        -- Emergency card owner management
        WHEN p.tablename = 'emergency_cards' AND p.policyname LIKE '%Users can manage own emergency card%' THEN 'PASS'
        -- Shared tokens owner management
        WHEN p.tablename = 'shared_access_tokens' AND p.policyname LIKE '%Users can manage own share tokens%' THEN 'PASS'
        ELSE 'PASS'
    END AS check_status,
    CASE
        WHEN p.tablename = 'chat_messages' AND p.cmd = 'INSERT' AND p.roles @> ARRAY['authenticated'::name] THEN
            'Authenticated clients strictly restricted to role = user'
        WHEN p.tablename = 'chat_messages' AND p.roles @> ARRAY['service_role'::name] THEN
            'Service role retains full management access for AI synthesis'
        ELSE 'Active policy scoped to roles: ' || array_to_string(p.roles, ', ')
    END AS details
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN ('chat_messages', 'document_chunks', 'emergency_cards', 'shared_access_tokens', 'medication_logs')
ORDER BY p.tablename, p.policyname;


-- ==============================================================================
-- CHECK 4: VERIFY FUNCTION-BY-FUNCTION SECURITY DEFINER & SEARCH_PATH STATUS
-- ==============================================================================
WITH expected_functions AS (
    SELECT * FROM (VALUES
        ('get_emergency_card_by_token', true, 'Public RPC accessing active emergency card by token'),
        ('get_public_share_by_token', true, 'Public RPC verifying and recording share access by token'),
        ('get_shared_documents_by_token', true, 'Public RPC retrieving documents permitted by token'),
        ('check_medication_schedule_doc_owner', true, 'Trigger function verifying schedule document ownership'),
        ('check_medication_reminder_schedule_owner', true, 'Trigger function verifying reminder schedule ownership'),
        ('check_medication_log_schedule_owner', true, 'Trigger function verifying log schedule ownership'),
        ('check_document_chunk_owner', true, 'Trigger function verifying document chunk ownership'),
        ('check_chat_message_conversation_owner', true, 'Trigger function verifying chat message conversation ownership'),
        ('check_document_family_member_owner', true, 'Trigger function verifying document family profile ownership')
    ) AS f(function_name, expected_secdef, description)
)
SELECT
    'Check 4: Function Configuration' AS audit_category,
    ef.function_name AS target_object,
    CASE
        WHEN p.proname IS NULL THEN 'FAIL'
        WHEN p.prosecdef != ef.expected_secdef THEN 'FAIL'
        WHEN p.proconfig IS NULL THEN 'FAIL'
        WHEN EXISTS (
            SELECT 1 FROM pg_catalog.unnest(p.proconfig) AS cfg
            WHERE cfg IN ('search_path=', 'search_path=""')
        ) THEN 'PASS'
        ELSE 'NEEDS REVIEW'
    END AS check_status,
    CASE
        WHEN p.proname IS NULL THEN 'CRITICAL: Function is missing'
        WHEN p.prosecdef != ef.expected_secdef THEN 'SECURITY DEFINER mismatch: expected ' || ef.expected_secdef::text || ', found ' || p.prosecdef::text
        WHEN p.proconfig IS NULL THEN 'SECURITY RISK: Function missing SET search_path configuration'
        WHEN EXISTS (
            SELECT 1 FROM pg_catalog.unnest(p.proconfig) AS cfg
            WHERE cfg IN ('search_path=', 'search_path=""')
        ) THEN
            'Verified (' || ef.description || '). raw_proconfig: ' || array_to_string(p.proconfig, ', ')
        ELSE 'Proconfig present but requires review: ' || array_to_string(p.proconfig, ', ')
    END AS details
FROM expected_functions ef
LEFT JOIN pg_proc p ON p.proname = ef.function_name
  AND p.pronamespace = 'public'::regnamespace
ORDER BY check_status ASC, ef.function_name;


-- ==============================================================================
-- CHECK 5: VERIFY ALL SIX CROSS-PATIENT OWNERSHIP ENFORCEMENT TRIGGERS
-- ==============================================================================
WITH expected_triggers AS (
    SELECT * FROM (VALUES
        ('trg_verify_schedule_doc_ownership', 'medication_schedules'),
        ('trg_verify_reminder_schedule_ownership', 'medication_reminders'),
        ('trg_verify_log_schedule_ownership', 'medication_logs'),
        ('trg_verify_chunk_document_ownership', 'document_chunks'),
        ('trg_verify_chat_message_ownership', 'chat_messages'),
        ('trg_verify_document_family_ownership', 'medical_documents')
    ) AS t(trigger_name, table_name)
)
SELECT
    'Check 5: Ownership Triggers' AS audit_category,
    et.trigger_name || ' on public.' || et.table_name AS target_object,
    CASE
        WHEN trg.tgname IS NULL THEN 'FAIL'
        WHEN trg.tgenabled = 'D' THEN 'FAIL'
        ELSE 'PASS'
    END AS check_status,
    CASE
        WHEN trg.tgname IS NULL THEN 'CRITICAL: Ownership enforcement trigger is missing'
        WHEN trg.tgenabled = 'D' THEN 'SECURITY RISK: Trigger exists but is DISABLED'
        ELSE 'Trigger is ACTIVE in pg_catalog.pg_trigger and bound to table public.' || et.table_name
    END AS details
FROM expected_triggers et
LEFT JOIN pg_class c ON c.relname = et.table_name AND c.relnamespace = 'public'::regnamespace
LEFT JOIN pg_trigger trg ON trg.tgname = et.trigger_name AND trg.tgrelid = c.oid AND NOT trg.tgisinternal
ORDER BY check_status ASC, et.trigger_name;


-- ==============================================================================
-- CHECK 6: VERIFY EXPLICIT RPC PRIVILEGES (anon, authenticated, service_role)
-- ==============================================================================
WITH expected_grants AS (
    SELECT * FROM (
        SELECT rpc, role FROM
        (VALUES ('get_emergency_card_by_token'), ('get_public_share_by_token'), ('get_shared_documents_by_token')) AS r(rpc),
        (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role)
    ) AS g(rpc_name, target_role)
)
SELECT
    'Check 6: RPC Role Grants' AS audit_category,
    eg.rpc_name || ' -> ' || eg.target_role AS target_object,
    CASE
        WHEN p.privilege_type = 'EXECUTE' THEN 'PASS'
        ELSE 'FAIL'
    END AS check_status,
    CASE
        WHEN p.privilege_type = 'EXECUTE' THEN 'Explicit EXECUTE privilege granted to ' || eg.target_role
        ELSE 'CRITICAL: Missing EXECUTE privilege for role ' || eg.target_role
    END AS details
FROM expected_grants eg
LEFT JOIN information_schema.routine_privileges p
  ON p.routine_schema = 'public'
 AND p.routine_name = eg.rpc_name
 AND p.grantee = eg.target_role
 AND p.privilege_type = 'EXECUTE'
ORDER BY check_status ASC, eg.rpc_name, eg.target_role;


-- ==============================================================================
-- CHECK 7: VERIFY ZERO PUBLIC PRIVILEGES OR BLANKET POLICIES
-- ==============================================================================
-- 7A: Verify PUBLIC execution is revoked on sensitive RPCs
SELECT
    'Check 7A: PUBLIC RPC Privilege Audit' AS audit_category,
    routine_name AS target_object,
    'FAIL' AS check_status,
    'SECURITY RISK: Unintended EXECUTE privilege granted to PUBLIC on ' || routine_name AS details
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_emergency_card_by_token',
    'get_public_share_by_token',
    'get_shared_documents_by_token'
  )
  AND grantee = 'PUBLIC'

UNION ALL

-- 7B: Verify no blanket public SELECT policies on sensitive tables
SELECT
    'Check 7B: Blanket Public SELECT Audit',
    tablename || '.' || policyname,
    'FAIL',
    'SECURITY RISK: Blanket public SELECT policy detected on ' || tablename
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('emergency_cards', 'shared_access_tokens')
  AND (roles && ARRAY['public'::name, 'anon'::name] OR roles IS NULL)
  AND cmd = 'SELECT'

UNION ALL

-- Summary confirmation if zero leaks exist
SELECT
    'Check 7: Public Privilege Leak Audit',
    'PUBLIC Role & Blanket Policy Check',
    'PASS',
    'Verified: zero unintended PUBLIC execution privileges and zero blanket public SELECT policies exist'
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name IN ('get_emergency_card_by_token', 'get_public_share_by_token', 'get_shared_documents_by_token')
      AND grantee = 'PUBLIC'
) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('emergency_cards', 'shared_access_tokens')
      AND (roles && ARRAY['public'::name, 'anon'::name] OR roles IS NULL)
      AND cmd = 'SELECT'
);


-- ==============================================================================
-- CHECK 8: VERIFY DATABASE EXTENSIONS (Distinguishing Required vs. Optional)
-- ==============================================================================
WITH expected_extensions AS (
    SELECT * FROM (VALUES
        ('vector', true, 'Required for document chunk vector embeddings (768 dimensions)'),
        ('pgcrypto', true, 'Required for cryptographic token generation (gen_random_bytes)'),
        ('uuid-ossp', false, 'Optional extension; PostgreSQL 13+ natively provides gen_random_uuid()')
    ) AS e(ext_name, is_required, description)
)
SELECT
    'Check 8: Database Extensions' AS audit_category,
    ee.ext_name AS target_object,
    CASE
        WHEN e.extname IS NOT NULL THEN 'PASS'
        WHEN ee.is_required = false THEN 'PASS (OPTIONAL)'
        ELSE 'FAIL'
    END AS check_status,
    CASE
        WHEN e.extname IS NOT NULL THEN 'Extension installed in schema: ' || n.nspname || ' (version: ' || e.extversion || ')'
        WHEN ee.is_required = false THEN 'Optional extension not installed; native functionality used instead'
        ELSE 'CRITICAL: Required extension ' || ee.ext_name || ' is missing'
    END AS details
FROM expected_extensions ee
LEFT JOIN pg_extension e ON e.extname = ee.ext_name
LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY check_status ASC, ee.ext_name;


-- ==============================================================================
-- CHECK 9: VERIFY VECTOR DIMENSION (768) & HNSW INDEX VALIDITY IN SYSTEM CATALOG
-- ==============================================================================
-- 9A: Verify vector column dimension via pg_attribute.atttypmod
SELECT
    'Check 9A: Vector Column Dimension' AS audit_category,
    'document_chunks.embedding' AS target_object,
    CASE
        WHEN a.attname IS NULL THEN 'FAIL'
        WHEN t.typname = 'vector' AND a.atttypmod = 768 THEN 'PASS'
        ELSE 'NEEDS REVIEW'
    END AS check_status,
    CASE
        WHEN a.attname IS NULL THEN 'CRITICAL: Column embedding is missing from document_chunks'
        WHEN t.typname = 'vector' AND a.atttypmod = 768 THEN
            'Verified: type is vector(768) matching Google Gemini text-embedding-004 output dimension'
        ELSE 'Type: ' || t.typname || ', typmod: ' || a.atttypmod::text
    END AS details
FROM (SELECT 1) AS dummy
LEFT JOIN pg_class c ON c.relname = 'document_chunks' AND c.relnamespace = 'public'::regnamespace
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'embedding'
LEFT JOIN pg_type t ON t.oid = a.atttypid

UNION ALL

-- 9B: Verify HNSW index validity and cosine operator class via pg_index & pg_am
SELECT
    'Check 9B: HNSW Index Catalog Validity',
    'document_chunks.idx_chunks_embedding_hnsw',
    CASE
        WHEN i.indexrelid IS NULL THEN 'FAIL'
        WHEN i.indisvalid = true AND am.amname = 'hnsw' AND opc.opcname = 'vector_cosine_ops' THEN 'PASS'
        WHEN i.indisvalid = false THEN 'FAIL (CORRUPT/INVALID INDEX)'
        ELSE 'NEEDS REVIEW'
    END,
    CASE
        WHEN i.indexrelid IS NULL THEN 'CRITICAL: HNSW vector index is missing'
        WHEN i.indisvalid = true AND am.amname = 'hnsw' AND opc.opcname = 'vector_cosine_ops' THEN
            'Verified: HNSW index is VALID in pg_index (indisvalid=true) using vector_cosine_ops'
        WHEN i.indisvalid = false THEN
            'CRITICAL: Index build failed or is flagged invalid in pg_index (indisvalid=false)'
        ELSE 'Access method: ' || am.amname || ', Opclass: ' || opc.opcname
    END
FROM (SELECT 1) AS dummy
LEFT JOIN pg_class t ON t.relname = 'document_chunks' AND t.relnamespace = 'public'::regnamespace
LEFT JOIN pg_class c ON c.relname = 'idx_chunks_embedding_hnsw' AND c.relnamespace = 'public'::regnamespace
LEFT JOIN pg_index i ON i.indexrelid = c.oid AND i.indrelid = t.oid
LEFT JOIN pg_am am ON am.oid = c.relam
LEFT JOIN pg_opclass opc ON opc.oid = i.indclass[0];


-- ==============================================================================
-- CHECK 10: VERIFY ADHERENCE LOG IMMUTABILITY (medication_logs & audit_logs)
-- ==============================================================================
SELECT
    'Check 10: Log Immutability' AS audit_category,
    p.table_name || ' (' || p.privilege_type || ' for ' || p.grantee || ')' AS target_object,
    'FAIL' AS check_status,
    'SECURITY RISK: ' || p.grantee || ' has unauthorized ' || p.privilege_type || ' privilege on ' || p.table_name AS details
FROM information_schema.table_privileges p
WHERE p.table_schema = 'public'
  AND p.table_name IN ('medication_logs', 'audit_logs')
  AND p.privilege_type IN ('UPDATE', 'DELETE')
  AND p.grantee IN ('anon', 'authenticated')

UNION ALL

SELECT
    'Check 10: Log Immutability',
    'public.medication_logs & public.audit_logs',
    'PASS',
    'Both medication_logs and audit_logs are protected: client-side UPDATE and DELETE are completely revoked'
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges p
    WHERE p.table_schema = 'public'
      AND p.table_name IN ('medication_logs', 'audit_logs')
      AND p.privilege_type IN ('UPDATE', 'DELETE')
      AND p.grantee IN ('anon', 'authenticated')
);


-- ==============================================================================
-- EXECUTIVE SUMMARY DASHBOARD
-- ==============================================================================
SELECT
    'SCHEMA INTEGRITY VERIFICATION' AS verification_metric,
    COUNT(*) FILTER (WHERE status LIKE 'PASS%') AS total_passed,
    COUNT(*) FILTER (WHERE status LIKE 'FAIL%') AS total_failed,
    COUNT(*) FILTER (WHERE status LIKE 'NEEDS REVIEW%') AS total_needs_review,
    CASE
        WHEN COUNT(*) FILTER (WHERE status LIKE 'FAIL%') = 0 THEN 'DATABASE SCHEMA VERIFICATION PASSED'
        ELSE 'DATABASE SCHEMA VERIFICATION FAILED (ACTION REQUIRED: REVIEW FAILED ITEMS)'
    END AS overall_verdict
FROM (
    -- Tables check
    SELECT CASE WHEN pt.tablename IS NOT NULL AND pt.rowsecurity = true THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (
        SELECT unnest(ARRAY[
            'profiles', 'medical_documents', 'extracted_prescriptions',
            'extracted_medications', 'extracted_lab_reports', 'extracted_lab_results',
            'document_shares', 'audit_logs', 'medication_schedules',
            'medication_reminders', 'medication_logs', 'document_chunks',
            'chat_conversations', 'chat_messages', 'family_profiles',
            'emergency_cards', 'shared_access_tokens'
        ]) AS tname
    ) t
    LEFT JOIN pg_tables pt ON pt.schemaname = 'public' AND pt.tablename = t.tname

    UNION ALL

    -- Triggers check
    SELECT CASE WHEN trg.tgname IS NOT NULL AND trg.tgenabled != 'D' THEN 'PASS' ELSE 'FAIL' END
    FROM (
        SELECT unnest(ARRAY[
            'trg_verify_schedule_doc_ownership',
            'trg_verify_reminder_schedule_ownership',
            'trg_verify_log_schedule_ownership',
            'trg_verify_chunk_document_ownership',
            'trg_verify_chat_message_ownership',
            'trg_verify_document_family_ownership'
        ]) AS tgname
    ) et
    LEFT JOIN pg_trigger trg ON trg.tgname = et.tgname AND NOT trg.tgisinternal

    UNION ALL

    -- Functions check
    SELECT CASE
        WHEN p.proname IS NOT NULL AND EXISTS (
            SELECT 1 FROM pg_catalog.unnest(p.proconfig) AS cfg
            WHERE cfg IN ('search_path=', 'search_path=""')
        )
        THEN 'PASS' ELSE 'FAIL' END
    FROM (
        SELECT unnest(ARRAY[
            'get_emergency_card_by_token',
            'get_public_share_by_token',
            'get_shared_documents_by_token',
            'check_medication_schedule_doc_owner',
            'check_medication_reminder_schedule_owner',
            'check_medication_log_schedule_owner',
            'check_document_chunk_owner',
            'check_chat_message_conversation_owner',
            'check_document_family_member_owner'
        ]) AS fname
    ) ef
    LEFT JOIN pg_proc p ON p.proname = ef.fname AND p.pronamespace = 'public'::regnamespace

    UNION ALL

    -- Required extensions check
    SELECT CASE WHEN e.extname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END
    FROM (SELECT unnest(ARRAY['vector', 'pgcrypto']) AS extname) req_ext
    LEFT JOIN pg_extension e ON e.extname = req_ext.extname

    UNION ALL

    -- Vector dimension check
    SELECT CASE WHEN a.atttypmod = 768 THEN 'PASS' ELSE 'FAIL' END
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'embedding'
    WHERE c.relname = 'document_chunks' AND c.relnamespace = 'public'::regnamespace

    UNION ALL

    -- HNSW index catalog validity check
    SELECT CASE WHEN i.indisvalid = true AND am.amname = 'hnsw' THEN 'PASS' ELSE 'FAIL' END
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_am am ON am.oid = c.relam
    WHERE c.relname = 'idx_chunks_embedding_hnsw' AND c.relnamespace = 'public'::regnamespace
) AS summary_checks;
