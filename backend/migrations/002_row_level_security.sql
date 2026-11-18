-- ==============================================================================
-- HealthSync AI — Migration 002: Row-Level Security (RLS) Policies
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable RLS on all tables
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_lab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Profiles Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 3. Medical Documents Policies
-- ------------------------------------------------------------------------------
-- Users can view their own documents or documents shared with them
CREATE POLICY "Users can view own or shared documents"
    ON public.medical_documents FOR SELECT
    USING (
        auth.uid() = user_id
        OR id IN (
            SELECT document_id FROM public.document_shares
            WHERE shared_with_user_id = auth.uid()
              AND is_revoked = false
              AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()))
        )
    );

CREATE POLICY "Users can insert own documents"
    ON public.medical_documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
    ON public.medical_documents FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
    ON public.medical_documents FOR DELETE
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. Extracted Prescriptions Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view own or shared prescriptions"
    ON public.extracted_prescriptions FOR SELECT
    USING (
        auth.uid() = user_id
        OR document_id IN (
            SELECT document_id FROM public.document_shares
            WHERE shared_with_user_id = auth.uid()
              AND is_revoked = false
              AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()))
        )
    );

CREATE POLICY "Users can manage own prescriptions"
    ON public.extracted_prescriptions FOR ALL
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5. Extracted Medications Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view own or shared medications"
    ON public.extracted_medications FOR SELECT
    USING (
        auth.uid() = user_id
        OR document_id IN (
            SELECT document_id FROM public.document_shares
            WHERE shared_with_user_id = auth.uid()
              AND is_revoked = false
              AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()))
        )
    );

CREATE POLICY "Users can manage own medications"
    ON public.extracted_medications FOR ALL
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6. Extracted Lab Reports & Results Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view own or shared lab reports"
    ON public.extracted_lab_reports FOR SELECT
    USING (
        auth.uid() = user_id
        OR document_id IN (
            SELECT document_id FROM public.document_shares
            WHERE shared_with_user_id = auth.uid()
              AND is_revoked = false
              AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()))
        )
    );

CREATE POLICY "Users can manage own lab reports"
    ON public.extracted_lab_reports FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own or shared lab results"
    ON public.extracted_lab_results FOR SELECT
    USING (
        auth.uid() = user_id
        OR document_id IN (
            SELECT document_id FROM public.document_shares
            WHERE shared_with_user_id = auth.uid()
              AND is_revoked = false
              AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()))
        )
    );

CREATE POLICY "Users can manage own lab results"
    ON public.extracted_lab_results FOR ALL
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 7. Document Shares Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Owners can manage document shares"
    ON public.document_shares FOR ALL
    USING (auth.uid() = owner_id);

CREATE POLICY "Recipients can view shares directed to them"
    ON public.document_shares FOR SELECT
    USING (auth.uid() = shared_with_user_id);

-- ------------------------------------------------------------------------------
-- 8. Audit Logs Policies (Append-Only; Non-Editable)
-- ------------------------------------------------------------------------------
-- Authenticated users can insert audit records for their actions
CREATE POLICY "Authenticated users can create audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Users can only view their own audit history
CREATE POLICY "Users can view own audit logs"
    ON public.audit_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Explicitly deny updates and deletes to audit logs for non-service roles
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
