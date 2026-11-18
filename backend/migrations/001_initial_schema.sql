-- ==============================================================================
-- HealthSync AI — Migration 001: Initial Database Schema
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table (Extends Supabase auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Trigger to automatically create a profile record when a new user registers in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', '')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. Medical Documents Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'other',
    status TEXT NOT NULL DEFAULT 'uploaded',
    raw_text TEXT,
    ocr_engine TEXT,
    confidence DOUBLE PRECISION,
    confidence_method TEXT,
    requires_verification BOOLEAN NOT NULL DEFAULT false,
    fields_requiring_verification JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_medical_documents_user_id ON public.medical_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_documents_status ON public.medical_documents(status);
CREATE INDEX IF NOT EXISTS idx_medical_documents_type ON public.medical_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_medical_documents_created ON public.medical_documents(created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. Extracted Prescriptions Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extracted_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_name TEXT,
    doctor_name TEXT,
    clinic_or_hospital TEXT,
    prescription_date TEXT,
    diagnosis_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_document_id ON public.extracted_prescriptions(document_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user_id ON public.extracted_prescriptions(user_id);

-- ------------------------------------------------------------------------------
-- 4. Extracted Medications Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extracted_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES public.extracted_prescriptions(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    duration TEXT,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_medications_prescription_id ON public.extracted_medications(prescription_id);
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON public.extracted_medications(user_id);

-- ------------------------------------------------------------------------------
-- 5. Extracted Lab Reports Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extracted_lab_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_name TEXT,
    doctor_or_lab_name TEXT,
    report_date TEXT,
    test_category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lab_reports_document_id ON public.extracted_lab_reports(document_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_user_id ON public.extracted_lab_reports(user_id);

-- ------------------------------------------------------------------------------
-- 6. Extracted Lab Results Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extracted_lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_report_id UUID NOT NULL REFERENCES public.extracted_lab_reports(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    measured_value TEXT,
    unit TEXT,
    reference_range TEXT,
    test_category TEXT,
    is_abnormal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lab_results_report_id ON public.extracted_lab_results(lab_report_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_user_id ON public.extracted_lab_results(user_id);

-- ------------------------------------------------------------------------------
-- 7. Document Shares Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with_email TEXT NOT NULL,
    shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    permission TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'review')),
    expires_at TIMESTAMPTZ,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_document_shares_doc ON public.document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_owner ON public.document_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_shared_user ON public.document_shares(shared_with_user_id);

-- ------------------------------------------------------------------------------
-- 8. Audit Logs Table (Append-Only)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
