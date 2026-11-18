-- ==============================================================================
-- HealthSync AI — Migration 007: Unified Structured Extraction Persistence,
-- Tri-State Verification, Least-Privilege Column RBAC, and Projection Sync
-- Target: PostgreSQL / Supabase
--
-- DESIGN & SAFETY GUARANTEES:
-- 1. Non-Destructive: No CASCADE drops, no overwriting pre-existing objects.
-- 2. Manifest Tracking: Self-tracks created objects into public._migration_007_manifest.
-- 3. Collision Preflight: Halts immediately if any target object already exists.
-- 4. Positive Allowlists: Strict type, status, and role validation.
-- 5. Atomic Projection: JSONB is authoritative; relational tables are query projections.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Preflight Collision Check & Manifest Creation
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_collision_count INT;
BEGIN
    -- Ensure manifest table does not already exist
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '_migration_007_manifest'
    ) THEN
        RAISE EXCEPTION 'PREFLIGHT ABORT: _migration_007_manifest already exists. Manual inspection required.';
    END IF;

    -- Ensure none of our intended functions collide with pre-existing routines
    SELECT COUNT(*) INTO v_collision_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
          'prevent_profile_role_self_promotion',
          '_sync_document_relational_projections',
          'save_document_extraction_atomic',
          'save_document_patient_review_atomic',
          'verify_document_as_clinician_atomic'
      );

    IF v_collision_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT ABORT: % pre-existing functions collide with Migration 007 namespace.', v_collision_count;
    END IF;

    -- Ensure review history table does not exist
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'document_review_history'
    ) THEN
        RAISE EXCEPTION 'PREFLIGHT ABORT: Table document_review_history already exists.';
    END IF;
END $$;

-- Create manifest table
CREATE TABLE public._migration_007_manifest (
    object_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    object_type VARCHAR(64) NOT NULL,
    object_schema VARCHAR(64) NOT NULL DEFAULT 'public',
    object_name VARCHAR(128) NOT NULL,
    parent_table VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    applied_by VARCHAR(128) NOT NULL DEFAULT CURRENT_USER,
    migration_version VARCHAR(32) NOT NULL DEFAULT '007_v1.0.0',
    CONSTRAINT uq_manifest_007 UNIQUE (object_type, object_schema, object_name, parent_table)
);

ALTER TABLE public._migration_007_manifest ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public._migration_007_manifest FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public._migration_007_manifest TO service_role;

-- Self-track manifest creation
INSERT INTO public._migration_007_manifest (object_type, object_schema, object_name)
VALUES ('table', 'public', '_migration_007_manifest');

-- ------------------------------------------------------------------------------
-- 2. Profiles Extensions & Column-Level Privilege Hardening
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Column: profiles.role
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'patient';
        ALTER TABLE public.profiles ADD CONSTRAINT ck_profiles_role CHECK (role IN ('patient', 'clinician', 'admin'));
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'role', 'profiles');
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('constraint', 'ck_profiles_role', 'profiles');
    END IF;

    -- Column: profiles.clinician_approval_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'clinician_approval_status') THEN
        ALTER TABLE public.profiles ADD COLUMN clinician_approval_status VARCHAR(32) NOT NULL DEFAULT 'none';
        ALTER TABLE public.profiles ADD CONSTRAINT ck_profiles_approval CHECK (clinician_approval_status IN ('none', 'pending', 'approved', 'rejected'));
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'clinician_approval_status', 'profiles');
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('constraint', 'ck_profiles_approval', 'profiles');
    END IF;

    -- Column: profiles.license_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'license_number') THEN
        ALTER TABLE public.profiles ADD COLUMN license_number VARCHAR(128) NULL;
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'license_number', 'profiles');
    END IF;

    -- Column: profiles.license_jurisdiction
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'license_jurisdiction') THEN
        ALTER TABLE public.profiles ADD COLUMN license_jurisdiction VARCHAR(64) NULL;
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'license_jurisdiction', 'profiles');
    END IF;
END $$;

-- Restrict authenticated role: can only update safe personal profile columns
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, updated_at) ON public.profiles TO authenticated;

-- Function: prevent_profile_role_self_promotion
CREATE FUNCTION public.prevent_profile_role_self_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_jwt_role TEXT;
    v_context_role TEXT;
BEGIN
    v_context_role := current_setting('request.jwt.claim.role', true);
    BEGIN
        v_jwt_role := (auth.jwt() ->> 'role');
    EXCEPTION WHEN OTHERS THEN
        v_jwt_role := NULL;
    END;

    IF (NEW.role IS DISTINCT FROM OLD.role) OR
       (NEW.clinician_approval_status IS DISTINCT FROM OLD.clinician_approval_status) OR
       (NEW.license_number IS DISTINCT FROM OLD.license_number) OR
       (NEW.license_jurisdiction IS DISTINCT FROM OLD.license_jurisdiction) THEN

        IF (v_context_role IS DISTINCT FROM 'service_role') AND 
           (v_jwt_role IS DISTINCT FROM 'service_role') AND 
           (CURRENT_USER IS DISTINCT FROM 'postgres') THEN
            RAISE EXCEPTION 'PERMISSION DENIED: Modifying role, approval status, or medical license requires service_role authority.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

INSERT INTO public._migration_007_manifest (object_type, object_name) 
VALUES ('function', 'prevent_profile_role_self_promotion');

CREATE TRIGGER trg_prevent_profile_role_self_promotion
    BEFORE UPDATE OF role, clinician_approval_status, license_number, license_jurisdiction
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_role_self_promotion();

INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) 
VALUES ('trigger', 'trg_prevent_profile_role_self_promotion', 'profiles');

-- ------------------------------------------------------------------------------
-- 3. Medical Documents Extensions & Integrity Constraints
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Column: extraction_result
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_documents' AND column_name = 'extraction_result') THEN
        ALTER TABLE public.medical_documents ADD COLUMN extraction_result JSONB NULL;
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'extraction_result', 'medical_documents');
    END IF;

    -- Column: user_reviewed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_documents' AND column_name = 'user_reviewed') THEN
        ALTER TABLE public.medical_documents ADD COLUMN user_reviewed BOOLEAN NOT NULL DEFAULT FALSE;
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'user_reviewed', 'medical_documents');
    END IF;

    -- Column: user_reviewed_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_documents' AND column_name = 'user_reviewed_at') THEN
        ALTER TABLE public.medical_documents ADD COLUMN user_reviewed_at TIMESTAMPTZ NULL;
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'user_reviewed_at', 'medical_documents');
    END IF;

    -- Column: clinician_verified
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_documents' AND column_name = 'clinician_verified') THEN
        ALTER TABLE public.medical_documents ADD COLUMN clinician_verified BOOLEAN NOT NULL DEFAULT FALSE;
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'clinician_verified', 'medical_documents');
    END IF;

    -- Column: clinician_verified_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_documents' AND column_name = 'clinician_verified_at') THEN
        ALTER TABLE public.medical_documents ADD COLUMN clinician_verified_at TIMESTAMPTZ NULL;
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'clinician_verified_at', 'medical_documents');
    END IF;

    -- Column: verified_by_user_id (ON DELETE SET NULL enables GDPR deletion without losing medical document record)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_documents' AND column_name = 'verified_by_user_id') THEN
        ALTER TABLE public.medical_documents ADD COLUMN verified_by_user_id UUID NULL 
            REFERENCES auth.users(id) ON DELETE SET NULL;
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'verified_by_user_id', 'medical_documents');
    END IF;

    -- Column: verified_by_clinician_snapshot
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_documents' AND column_name = 'verified_by_clinician_snapshot') THEN
        ALTER TABLE public.medical_documents ADD COLUMN verified_by_clinician_snapshot JSONB NULL;
        INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) VALUES ('column', 'verified_by_clinician_snapshot', 'medical_documents');
    END IF;
END $$;

-- Check Constraint: Extraction integrity
-- Non-medical or unsupported docs MUST have NULL extraction_result.
-- Otherwise, extraction_result must be a JSON object with matching document_type.
ALTER TABLE public.medical_documents ADD CONSTRAINT ck_medical_documents_extraction_integrity CHECK (
    (
        (document_type = 'non_medical' OR status = 'unsupported') 
        AND extraction_result IS NULL
    ) OR (
        document_type NOT IN ('non_medical', 'unsupported') AND (
            extraction_result IS NULL OR (
                jsonb_typeof(extraction_result) = 'object' AND
                (extraction_result ? 'document_type') AND
                ((extraction_result->>'document_type') = document_type)
            )
        )
    )
);
INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) 
VALUES ('constraint', 'ck_medical_documents_extraction_integrity', 'medical_documents');

-- Check Constraint: Verification state consistency
ALTER TABLE public.medical_documents ADD CONSTRAINT ck_medical_documents_verification_state CHECK (
    (clinician_verified = FALSE AND clinician_verified_at IS NULL AND verified_by_user_id IS NULL AND verified_by_clinician_snapshot IS NULL) OR
    (clinician_verified = TRUE  AND clinician_verified_at IS NOT NULL AND verified_by_clinician_snapshot IS NOT NULL)
);
INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) 
VALUES ('constraint', 'ck_medical_documents_verification_state', 'medical_documents');

-- GIN Index on extraction_result
CREATE INDEX idx_medical_documents_extraction_gin ON public.medical_documents USING gin (extraction_result jsonb_path_ops);
INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) 
VALUES ('index', 'idx_medical_documents_extraction_gin', 'medical_documents');

-- ------------------------------------------------------------------------------
-- 4. Document Review History Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.document_review_history (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
    reviewed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reviewer_role VARCHAR(32) NOT NULL,
    review_type VARCHAR(32) NOT NULL,
    previous_extraction JSONB NULL,
    updated_extraction JSONB NOT NULL,
    diff_summary JSONB NOT NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_review_role CHECK (reviewer_role IN ('patient', 'clinician', 'admin')),
    CONSTRAINT ck_review_type CHECK (review_type IN ('patient_correction', 'clinician_verification', 'admin_override'))
);

INSERT INTO public._migration_007_manifest (object_type, object_name) 
VALUES ('table', 'document_review_history');

CREATE INDEX idx_doc_review_history_doc_created ON public.document_review_history (document_id, created_at DESC);
INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) 
VALUES ('index', 'idx_doc_review_history_doc_created', 'document_review_history');

ALTER TABLE public.document_review_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_review_history_select_owner" ON public.document_review_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.medical_documents md
            WHERE md.id = document_review_history.document_id
              AND md.user_id = auth.uid()
        )
    );
INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) 
VALUES ('policy', 'document_review_history_select_owner', 'document_review_history');

CREATE POLICY "document_review_history_select_clinician" ON public.document_review_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'clinician'
              AND p.clinician_approval_status = 'approved'
        )
    );
INSERT INTO public._migration_007_manifest (object_type, object_name, parent_table) 
VALUES ('policy', 'document_review_history_select_clinician', 'document_review_history');

REVOKE INSERT, UPDATE, DELETE ON public.document_review_history FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.document_review_history TO service_role;

-- ------------------------------------------------------------------------------
-- 5. Relational Projection Synchronizer
-- Note: Reconciled with actual Migrations 001-006 table names:
--       extracted_prescriptions, extracted_medications,
--       extracted_lab_reports, extracted_lab_results.
-- ------------------------------------------------------------------------------
CREATE FUNCTION public._sync_document_relational_projections(
    p_document_id UUID,
    p_user_id UUID,
    p_document_type VARCHAR(32),
    p_extraction_result JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_presc_id UUID;
    v_med RECORD;
    v_lab_id UUID;
    v_test RECORD;
    v_med_count INT;
    v_test_count INT;
BEGIN
    -- 1. Unconditionally purge existing relational projections for this document
    DELETE FROM public.extracted_prescriptions WHERE document_id = p_document_id;
    DELETE FROM public.extracted_lab_reports WHERE document_id = p_document_id;

    -- Exit if no extraction payload or if not a supported relational document type
    IF p_extraction_result IS NULL OR p_document_type NOT IN ('prescription', 'lab_report', 'blood_test', 'laboratory_report') THEN
        RETURN;
    END IF;

    -- 2. Synchronize Prescription Projections
    IF p_document_type = 'prescription' THEN
        v_med_count := jsonb_array_length(COALESCE(p_extraction_result->'structured_data'->'medications', '[]'::jsonb));
        
        INSERT INTO public.extracted_prescriptions (
            document_id,
            user_id,
            patient_name,
            doctor_name,
            clinic_or_hospital,
            prescription_date,
            diagnosis_text
        ) VALUES (
            p_document_id,
            p_user_id,
            NULLIF(trim(p_extraction_result->'structured_data'->>'patient_name'), ''),
            NULLIF(trim(p_extraction_result->'structured_data'->>'doctor_name'), ''),
            NULLIF(trim(p_extraction_result->'structured_data'->>'clinic_or_hospital'), ''),
            NULLIF(trim(p_extraction_result->'structured_data'->>'prescription_date'), ''),
            NULLIF(trim(p_extraction_result->'structured_data'->>'diagnosis_text'), '')
        ) RETURNING id INTO v_presc_id;

        IF v_med_count > 0 THEN
            FOR v_med IN 
                SELECT 
                    value->>'name' AS med_name,
                    value->>'dosage' AS dosage,
                    value->>'frequency' AS frequency,
                    value->>'duration' AS duration,
                    value->>'instructions' AS instructions
                FROM jsonb_array_elements(p_extraction_result->'structured_data'->'medications')
            LOOP
                IF NULLIF(trim(v_med.med_name), '') IS NOT NULL THEN
                    INSERT INTO public.extracted_medications (
                        prescription_id,
                        document_id,
                        user_id,
                        name,
                        dosage,
                        frequency,
                        duration,
                        instructions
                    ) VALUES (
                        v_presc_id,
                        p_document_id,
                        p_user_id,
                        trim(v_med.med_name),
                        NULLIF(trim(v_med.dosage), ''),
                        NULLIF(trim(v_med.frequency), ''),
                        NULLIF(trim(v_med.duration), ''),
                        NULLIF(trim(v_med.instructions), '')
                    );
                END IF;
            END LOOP;
        END IF;

    -- 3. Synchronize Lab Report Projections
    ELSIF p_document_type IN ('lab_report', 'blood_test', 'laboratory_report') THEN
        v_test_count := jsonb_array_length(COALESCE(p_extraction_result->'structured_data'->'tests', '[]'::jsonb));

        INSERT INTO public.extracted_lab_reports (
            document_id,
            user_id,
            patient_name,
            doctor_or_lab_name,
            report_date,
            test_category
        ) VALUES (
            p_document_id,
            p_user_id,
            NULLIF(trim(p_extraction_result->'structured_data'->>'patient_name'), ''),
            NULLIF(trim(p_extraction_result->'structured_data'->>'doctor_or_lab_name'), ''),
            NULLIF(trim(p_extraction_result->'structured_data'->>'report_date'), ''),
            NULLIF(trim(p_extraction_result->'structured_data'->>'test_category'), '')
        ) RETURNING id INTO v_lab_id;

        IF v_test_count > 0 THEN
            FOR v_test IN 
                SELECT 
                    value->>'test_name' AS test_name,
                    value->>'measured_value' AS measured_value,
                    value->>'unit' AS unit,
                    value->>'reference_range' AS reference_range,
                    value->>'test_category' AS test_category,
                    value->>'is_abnormal' AS is_abnormal
                FROM jsonb_array_elements(p_extraction_result->'structured_data'->'tests')
            LOOP
                IF NULLIF(trim(v_test.test_name), '') IS NOT NULL THEN
                    INSERT INTO public.extracted_lab_results (
                        lab_report_id,
                        document_id,
                        user_id,
                        test_name,
                        measured_value,
                        unit,
                        reference_range,
                        test_category,
                        is_abnormal
                    ) VALUES (
                        v_lab_id,
                        p_document_id,
                        p_user_id,
                        trim(v_test.test_name),
                        NULLIF(trim(v_test.measured_value), ''),
                        NULLIF(trim(v_test.unit), ''),
                        NULLIF(trim(v_test.reference_range), ''),
                        NULLIF(trim(v_test.test_category), ''),
                        COALESCE(v_test.is_abnormal::boolean, FALSE)
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;
END;
$$;

INSERT INTO public._migration_007_manifest (object_type, object_name) 
VALUES ('function', '_sync_document_relational_projections');

REVOKE ALL ON FUNCTION public._sync_document_relational_projections(UUID, UUID, VARCHAR, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sync_document_relational_projections(UUID, UUID, VARCHAR, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC: save_document_extraction_atomic (service_role only)
-- ------------------------------------------------------------------------------
CREATE FUNCTION public.save_document_extraction_atomic(
    p_document_id UUID,
    p_document_type VARCHAR(32),
    p_status VARCHAR(32),
    p_confidence_score NUMERIC,
    p_ocr_model VARCHAR(64),
    p_pipeline_version VARCHAR(32),
    p_structured_data JSONB,
    p_requires_verification BOOLEAN,
    p_fields_requiring_verification TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_context_role TEXT;
    v_jwt_role TEXT;
    v_existing_doc RECORD;
    v_final_extraction JSONB;
BEGIN
    -- Strict service_role authorization
    v_context_role := current_setting('request.jwt.claim.role', true);
    BEGIN
        v_jwt_role := (auth.jwt() ->> 'role');
    EXCEPTION WHEN OTHERS THEN
        v_jwt_role := NULL;
    END;

    IF (v_context_role IS DISTINCT FROM 'service_role') AND 
       (v_jwt_role IS DISTINCT FROM 'service_role') AND 
       (CURRENT_USER IS DISTINCT FROM 'postgres') THEN
        RAISE EXCEPTION 'SECURITY ERROR: save_document_extraction_atomic is restricted to trusted service_role.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Enum Validation
    IF p_document_type NOT IN ('prescription', 'blood_test', 'lab_report', 'laboratory_report', 'imaging_report', 'discharge_summary', 'consultation_record', 'non_medical', 'other') THEN
        RAISE EXCEPTION 'INVALID PARAMETER: document_type % is unsupported.', p_document_type
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_status NOT IN ('uploaded', 'processing', 'extracted', 'needs_review', 'completed', 'unsupported', 'failed') THEN
        RAISE EXCEPTION 'INVALID PARAMETER: status % is unsupported.', p_status
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT * INTO v_existing_doc
    FROM public.medical_documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT FOUND: Document % does not exist.', p_document_id
            USING ERRCODE = 'no_data_found';
    END IF;

    -- Non-medical or unsupported docs MUST have NULL extraction_result
    IF p_document_type = 'non_medical' OR p_status = 'unsupported' THEN
        v_final_extraction := NULL;
    ELSE
        -- Single-pass reconstruction using trusted database verification state
        v_final_extraction := jsonb_build_object(
            'document_type', p_document_type,
            'status', p_status,
            'confidence_score', p_confidence_score,
            'structured_data', COALESCE(p_structured_data, '{}'::jsonb),
            'extraction_metadata', jsonb_build_object(
                'pipeline_version', COALESCE(p_pipeline_version, 'v1.0'),
                'ocr_model', COALESCE(p_ocr_model, 'gemini-1.5-pro'),
                'extracted_at', clock_timestamp(),
                'execution_role', 'service_role'
            ),
            'verification_state', jsonb_build_object(
                'user_reviewed', v_existing_doc.user_reviewed,
                'user_reviewed_at', v_existing_doc.user_reviewed_at,
                'clinician_verified', v_existing_doc.clinician_verified,
                'clinician_verified_at', v_existing_doc.clinician_verified_at,
                'verified_by_user_id', v_existing_doc.verified_by_user_id,
                'requires_verification', COALESCE(p_requires_verification, FALSE),
                'fields_requiring_verification', to_jsonb(COALESCE(p_fields_requiring_verification, ARRAY[]::TEXT[]))
            )
        );
    END IF;

    UPDATE public.medical_documents
    SET
        document_type = p_document_type,
        status = p_status,
        confidence = p_confidence_score,
        extraction_result = v_final_extraction,
        requires_verification = COALESCE(p_requires_verification, FALSE),
        fields_requiring_verification = to_jsonb(COALESCE(p_fields_requiring_verification, ARRAY[]::TEXT[])),
        updated_at = clock_timestamp()
    WHERE id = p_document_id;

    PERFORM public._sync_document_relational_projections(
        p_document_id,
        v_existing_doc.user_id,
        p_document_type,
        v_final_extraction
    );

    RETURN v_final_extraction;
END;
$$;

INSERT INTO public._migration_007_manifest (object_type, object_name) 
VALUES ('function', 'save_document_extraction_atomic');

REVOKE ALL ON FUNCTION public.save_document_extraction_atomic(UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, VARCHAR, JSONB, BOOLEAN, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_document_extraction_atomic(UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, VARCHAR, JSONB, BOOLEAN, TEXT[]) TO service_role;

-- ------------------------------------------------------------------------------
-- 7. RPC: save_document_patient_review_atomic (Document Owner Only)
-- ------------------------------------------------------------------------------
CREATE FUNCTION public.save_document_patient_review_atomic(
    p_document_id UUID,
    p_corrected_structured_data JSONB,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_caller_id UUID;
    v_doc RECORD;
    v_final_extraction JSONB;
    v_diff_summary JSONB;
    v_old_data JSONB;
    v_key TEXT;
    v_added JSONB := '{}'::jsonb;
    v_removed JSONB := '{}'::jsonb;
    v_modified JSONB := '{}'::jsonb;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'SECURITY ERROR: Unauthenticated session.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_doc
    FROM public.medical_documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT FOUND: Document % does not exist.', p_document_id
            USING ERRCODE = 'no_data_found';
    END IF;

    IF v_doc.user_id IS DISTINCT FROM v_caller_id THEN
        RAISE EXCEPTION 'ACCESS DENIED: Caller does not own document %.', p_document_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_doc.document_type IN ('non_medical', 'other') THEN
        RAISE EXCEPTION 'INVALID OPERATION: Non-medical documents cannot receive patient structured review.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF v_doc.extraction_result IS NULL THEN
        RAISE EXCEPTION 'INVALID STATE: Cannot review document without prior extraction payload.'
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    v_old_data := COALESCE(v_doc.extraction_result->'structured_data', '{}'::jsonb);

    -- Three-Way Audit Diff (Deterministically detects added, removed, modified keys)
    FOR v_key IN 
        SELECT DISTINCT k FROM (
            SELECT jsonb_object_keys(v_old_data) AS k
            UNION
            SELECT jsonb_object_keys(p_corrected_structured_data) AS k
        ) all_keys ORDER BY k
    LOOP
        IF NOT (v_old_data ? v_key) AND (p_corrected_structured_data ? v_key) THEN
            v_added := v_added || jsonb_build_object(v_key, p_corrected_structured_data->v_key);
        ELSIF (v_old_data ? v_key) AND NOT (p_corrected_structured_data ? v_key) THEN
            v_removed := v_removed || jsonb_build_object(v_key, v_old_data->v_key);
        ELSIF (v_old_data->v_key) IS DISTINCT FROM (p_corrected_structured_data->v_key) THEN
            v_modified := v_modified || jsonb_build_object(
                v_key, jsonb_build_object(
                    'old', v_old_data->v_key,
                    'new', p_corrected_structured_data->v_key
                )
            );
        END IF;
    END LOOP;

    v_diff_summary := jsonb_build_object(
        'added', v_added,
        'removed', v_removed,
        'modified', v_modified,
        'calculated_at', clock_timestamp()
    );

    -- Preserve clinician verification state: patient review cannot verify clinically
    v_final_extraction := jsonb_build_object(
        'document_type', v_doc.document_type,
        'status', 'extracted',
        'confidence_score', v_doc.confidence,
        'structured_data', p_corrected_structured_data,
        'extraction_metadata', v_doc.extraction_result->'extraction_metadata',
        'verification_state', jsonb_build_object(
            'user_reviewed', TRUE,
            'user_reviewed_at', clock_timestamp(),
            'clinician_verified', v_doc.clinician_verified,
            'clinician_verified_at', v_doc.clinician_verified_at,
            'verified_by_user_id', v_doc.verified_by_user_id,
            'requires_verification', v_doc.requires_verification,
            'fields_requiring_verification', v_doc.fields_requiring_verification
        )
    );

    UPDATE public.medical_documents
    SET
        extraction_result = v_final_extraction,
        user_reviewed = TRUE,
        user_reviewed_at = clock_timestamp(),
        status = 'extracted',
        updated_at = clock_timestamp()
    WHERE id = p_document_id;

    INSERT INTO public.document_review_history (
        document_id,
        reviewed_by_user_id,
        reviewer_role,
        review_type,
        previous_extraction,
        updated_extraction,
        diff_summary,
        review_notes
    ) VALUES (
        p_document_id,
        v_caller_id,
        'patient',
        'patient_correction',
        v_doc.extraction_result,
        v_final_extraction,
        v_diff_summary,
        p_review_notes
    );

    PERFORM public._sync_document_relational_projections(
        p_document_id,
        v_doc.user_id,
        v_doc.document_type,
        v_final_extraction
    );

    RETURN v_final_extraction;
END;
$$;

INSERT INTO public._migration_007_manifest (object_type, object_name) 
VALUES ('function', 'save_document_patient_review_atomic');

REVOKE ALL ON FUNCTION public.save_document_patient_review_atomic(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document_patient_review_atomic(UUID, JSONB, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. RPC: verify_document_as_clinician_atomic (Approved Clinician Only)
-- ------------------------------------------------------------------------------
CREATE FUNCTION public.verify_document_as_clinician_atomic(
    p_document_id UUID,
    p_verified_structured_data JSONB,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_caller_id UUID;
    v_clinician RECORD;
    v_doc RECORD;
    v_clinician_snapshot JSONB;
    v_final_extraction JSONB;
    v_diff_summary JSONB;
    v_old_data JSONB;
    v_key TEXT;
    v_added JSONB := '{}'::jsonb;
    v_removed JSONB := '{}'::jsonb;
    v_modified JSONB := '{}'::jsonb;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'SECURITY ERROR: Unauthenticated session.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Verify caller is an approved clinician
    SELECT * INTO v_clinician
    FROM public.profiles
    WHERE id = v_caller_id;

    IF NOT FOUND OR v_clinician.role IS DISTINCT FROM 'clinician' OR v_clinician.clinician_approval_status IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'PERMISSION DENIED: Caller % is not an approved clinician.', v_caller_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_doc
    FROM public.medical_documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT FOUND: Document % does not exist.', p_document_id
            USING ERRCODE = 'no_data_found';
    END IF;

    -- Positive allowlist on document eligibility for clinician verification
    IF v_doc.document_type NOT IN ('prescription', 'lab_report', 'blood_test', 'laboratory_report', 'discharge_summary', 'consultation_record') THEN
        RAISE EXCEPTION 'INVALID OPERATION: Document type % is not eligible for clinical verification.', v_doc.document_type
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF v_doc.status NOT IN ('extracted', 'needs_review', 'completed') THEN
        RAISE EXCEPTION 'INVALID STATE: Document status % cannot be verified.', v_doc.status
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    IF v_doc.extraction_result IS NULL THEN
        RAISE EXCEPTION 'INVALID STATE: Cannot verify document without extraction payload.'
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    -- Build immutable clinician snapshot
    v_clinician_snapshot := jsonb_build_object(
        'clinician_user_id', v_caller_id,
        'full_name', v_clinician.full_name,
        'license_number', COALESCE(v_clinician.license_number, 'UNSPECIFIED'),
        'license_jurisdiction', COALESCE(v_clinician.license_jurisdiction, 'UNSPECIFIED'),
        'verified_at', v_now
    );

    v_old_data := COALESCE(v_doc.extraction_result->'structured_data', '{}'::jsonb);

    FOR v_key IN 
        SELECT DISTINCT k FROM (
            SELECT jsonb_object_keys(v_old_data) AS k
            UNION
            SELECT jsonb_object_keys(p_verified_structured_data) AS k
        ) all_keys ORDER BY k
    LOOP
        IF NOT (v_old_data ? v_key) AND (p_verified_structured_data ? v_key) THEN
            v_added := v_added || jsonb_build_object(v_key, p_verified_structured_data->v_key);
        ELSIF (v_old_data ? v_key) AND NOT (p_verified_structured_data ? v_key) THEN
            v_removed := v_removed || jsonb_build_object(v_key, v_old_data->v_key);
        ELSIF (v_old_data->v_key) IS DISTINCT FROM (p_verified_structured_data->v_key) THEN
            v_modified := v_modified || jsonb_build_object(
                v_key, jsonb_build_object(
                    'old', v_old_data->v_key,
                    'new', p_verified_structured_data->v_key
                )
            );
        END IF;
    END LOOP;

    v_diff_summary := jsonb_build_object(
        'added', v_added,
        'removed', v_removed,
        'modified', v_modified,
        'calculated_at', v_now
    );

    v_final_extraction := jsonb_build_object(
        'document_type', v_doc.document_type,
        'status', 'extracted',
        'confidence_score', 1.0,
        'structured_data', p_verified_structured_data,
        'extraction_metadata', v_doc.extraction_result->'extraction_metadata',
        'verification_state', jsonb_build_object(
            'user_reviewed', v_doc.user_reviewed,
            'user_reviewed_at', v_doc.user_reviewed_at,
            'clinician_verified', TRUE,
            'clinician_verified_at', v_now,
            'verified_by_user_id', v_caller_id,
            'verified_by_snapshot', v_clinician_snapshot,
            'requires_verification', FALSE,
            'fields_requiring_verification', '[]'::jsonb
        )
    );

    UPDATE public.medical_documents
    SET
        extraction_result = v_final_extraction,
        clinician_verified = TRUE,
        clinician_verified_at = v_now,
        verified_by_user_id = v_caller_id,
        verified_by_clinician_snapshot = v_clinician_snapshot,
        requires_verification = FALSE,
        fields_requiring_verification = '[]'::jsonb,
        status = 'extracted',
        updated_at = v_now
    WHERE id = p_document_id;

    INSERT INTO public.document_review_history (
        document_id,
        reviewed_by_user_id,
        reviewer_role,
        review_type,
        previous_extraction,
        updated_extraction,
        diff_summary,
        review_notes
    ) VALUES (
        p_document_id,
        v_caller_id,
        'clinician',
        'clinician_verification',
        v_doc.extraction_result,
        v_final_extraction,
        v_diff_summary,
        p_review_notes
    );

    PERFORM public._sync_document_relational_projections(
        p_document_id,
        v_doc.user_id,
        v_doc.document_type,
        v_final_extraction
    );

    RETURN v_final_extraction;
END;
$$;

INSERT INTO public._migration_007_manifest (object_type, object_name) 
VALUES ('function', 'verify_document_as_clinician_atomic');

REVOKE ALL ON FUNCTION public.verify_document_as_clinician_atomic(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_document_as_clinician_atomic(UUID, JSONB, TEXT) TO authenticated, service_role;

COMMIT;
