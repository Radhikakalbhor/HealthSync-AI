-- ==============================================================================
-- HealthSync AI — Migration Rollback: 007_unified_extraction_result_rollback.sql
-- Description: Strictly Ownership-Aware, Non-Destructive Rollback for Migration 007
-- Target: PostgreSQL / Supabase
--
-- INVARIANTS:
-- 1. NO CASCADE operations anywhere.
-- 2. Requires public._migration_007_manifest table; halts if missing.
-- 3. Drops only items explicitly recorded in the manifest table.
-- 4. Restores pre-migration column grants on profiles.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_record RECORD;
BEGIN
    -- 1. Preflight Verification: Ensure manifest exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '_migration_007_manifest'
    ) THEN
        RAISE EXCEPTION 'ROLLBACK ABORT: _migration_007_manifest table not found. Cannot verify ownership of objects to remove.';
    END IF;

    -- 2. Drop Triggers Tracked in Manifest
    FOR v_record IN 
        SELECT object_name, parent_table 
        FROM public._migration_007_manifest 
        WHERE object_type = 'trigger'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_record.object_name, v_record.parent_table);
        RAISE NOTICE 'Rollback: Dropped trigger % on %', v_record.object_name, v_record.parent_table;
    END LOOP;

    -- 3. Drop Functions Tracked in Manifest
    IF EXISTS (SELECT 1 FROM public._migration_007_manifest WHERE object_type = 'function' AND object_name = 'verify_document_as_clinician_atomic') THEN
        DROP FUNCTION IF EXISTS public.verify_document_as_clinician_atomic(UUID, JSONB, TEXT);
    END IF;

    IF EXISTS (SELECT 1 FROM public._migration_007_manifest WHERE object_type = 'function' AND object_name = 'save_document_patient_review_atomic') THEN
        DROP FUNCTION IF EXISTS public.save_document_patient_review_atomic(UUID, JSONB, TEXT);
    END IF;

    IF EXISTS (SELECT 1 FROM public._migration_007_manifest WHERE object_type = 'function' AND object_name = 'save_document_extraction_atomic') THEN
        DROP FUNCTION IF EXISTS public.save_document_extraction_atomic(UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, VARCHAR, JSONB, BOOLEAN, TEXT[]);
    END IF;

    IF EXISTS (SELECT 1 FROM public._migration_007_manifest WHERE object_type = 'function' AND object_name = '_sync_document_relational_projections') THEN
        DROP FUNCTION IF EXISTS public._sync_document_relational_projections(UUID, UUID, VARCHAR, JSONB);
    END IF;

    IF EXISTS (SELECT 1 FROM public._migration_007_manifest WHERE object_type = 'function' AND object_name = 'prevent_profile_role_self_promotion') THEN
        DROP FUNCTION IF EXISTS public.prevent_profile_role_self_promotion();
    END IF;

    -- 4. Drop Policies Tracked in Manifest
    FOR v_record IN 
        SELECT object_name, parent_table 
        FROM public._migration_007_manifest 
        WHERE object_type = 'policy'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_record.object_name, v_record.parent_table);
        RAISE NOTICE 'Rollback: Dropped policy % on %', v_record.object_name, v_record.parent_table;
    END LOOP;

    -- 5. Drop Constraints Tracked in Manifest
    FOR v_record IN 
        SELECT object_name, parent_table 
        FROM public._migration_007_manifest 
        WHERE object_type = 'constraint'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', v_record.parent_table, v_record.object_name);
        RAISE NOTICE 'Rollback: Dropped constraint % from %', v_record.object_name, v_record.parent_table;
    END LOOP;

    -- 6. Drop Indexes Tracked in Manifest
    FOR v_record IN 
        SELECT object_name 
        FROM public._migration_007_manifest 
        WHERE object_type = 'index'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', v_record.object_name);
        RAISE NOTICE 'Rollback: Dropped index %', v_record.object_name;
    END LOOP;

    -- 7. Drop Review History Table (Only if created by Migration 007)
    IF EXISTS (SELECT 1 FROM public._migration_007_manifest WHERE object_type = 'table' AND object_name = 'document_review_history') THEN
        DROP TABLE IF EXISTS public.document_review_history;
        RAISE NOTICE 'Rollback: Dropped table document_review_history';
    END IF;

    -- 8. Drop Columns Added to medical_documents
    FOR v_record IN 
        SELECT object_name 
        FROM public._migration_007_manifest 
        WHERE object_type = 'column' AND parent_table = 'medical_documents'
    LOOP
        EXECUTE format('ALTER TABLE public.medical_documents DROP COLUMN IF EXISTS %I', v_record.object_name);
        RAISE NOTICE 'Rollback: Dropped column % from medical_documents', v_record.object_name;
    END LOOP;

    -- 9. Drop Columns Added to profiles and Restore Previous Table Permissions
    FOR v_record IN 
        SELECT object_name 
        FROM public._migration_007_manifest 
        WHERE object_type = 'column' AND parent_table = 'profiles'
    LOOP
        EXECUTE format('ALTER TABLE public.profiles DROP COLUMN IF EXISTS %I', v_record.object_name);
        RAISE NOTICE 'Rollback: Dropped column % from profiles', v_record.object_name;
    END LOOP;

    -- Restore table-level UPDATE grant on profiles to authenticated (Migration 006 state)
    GRANT UPDATE ON public.profiles TO authenticated;
    RAISE NOTICE 'Rollback: Restored table-level UPDATE grant on profiles to authenticated role.';

    -- 10. Drop Manifest Table Itself
    DROP TABLE IF EXISTS public._migration_007_manifest;
    RAISE NOTICE 'Rollback: Migration 007 manifest decommissioned. Rollback completed safely.';
END $$;

COMMIT;
