-- ==============================================================================
-- HealthSync AI — Migration 005: Family Profiles, Emergency Cards & Tokens
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Enable pgcrypto extension for secure token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 2. Family Profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'Other', -- 'Self', 'Spouse', 'Child', 'Parent', 'Other'
    date_of_birth DATE,
    gender TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Link medical documents to optional family member
ALTER TABLE public.medical_documents
ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES public.family_profiles(id) ON DELETE SET NULL;

-- Enforce that a document can only be associated with a family profile owned by the document's owner
CREATE OR REPLACE FUNCTION public.check_document_family_member_owner()
RETURNS trigger AS $$
BEGIN
    IF NEW.family_member_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.family_profiles
            WHERE id = NEW.family_member_id
              AND account_owner_id = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Ownership mismatch: family_member_id % does not belong to document owner %',
                NEW.family_member_id, NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_verify_document_family_ownership ON public.medical_documents;
CREATE TRIGGER trg_verify_document_family_ownership
    BEFORE INSERT OR UPDATE OF family_member_id, user_id ON public.medical_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.check_document_family_member_owner();

-- ------------------------------------------------------------------------------
-- 3. Emergency Health Cards
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    emergency_token TEXT NOT NULL UNIQUE,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
    confirmed_medications JSONB NOT NULL DEFAULT '[]'::jsonb,
    blood_group TEXT,
    critical_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ------------------------------------------------------------------------------
-- 4. Secure QR Code / Temporary Document Sharing Tokens
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    recipient_label TEXT,
    permission_level TEXT NOT NULL DEFAULT 'READ_ONLY',
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    view_count INT NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_shared_permission CHECK (permission_level IN ('READ_ONLY', 'read_only'))
);

-- ------------------------------------------------------------------------------
-- 5. Dynamic pgcrypto Schema Resolution for Token Column Defaults
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_schema text;
BEGIN
    SELECT n.nspname INTO v_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto';

    IF v_schema IS NULL THEN
        RAISE EXCEPTION 'pgcrypto extension is missing. Run: CREATE EXTENSION pgcrypto;';
    END IF;

    EXECUTE format(
        'ALTER TABLE public.emergency_cards ALTER COLUMN emergency_token SET DEFAULT pg_catalog.encode(%I.gen_random_bytes(16), ''hex'');',
        v_schema
    );
    EXECUTE format(
        'ALTER TABLE public.shared_access_tokens ALTER COLUMN share_token SET DEFAULT pg_catalog.encode(%I.gen_random_bytes(24), ''hex'');',
        v_schema
    );
END $$;

-- ------------------------------------------------------------------------------
-- 6. Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_family_owner ON public.family_profiles(account_owner_id);
CREATE INDEX IF NOT EXISTS idx_emergency_token ON public.emergency_cards(emergency_token);
CREATE INDEX IF NOT EXISTS idx_shares_token ON public.shared_access_tokens(share_token);
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON public.shared_access_tokens(user_id);

-- ------------------------------------------------------------------------------
-- 7. Row-Level Security
-- ------------------------------------------------------------------------------
ALTER TABLE public.family_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_access_tokens ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy blanket public policies if previously applied
DROP POLICY IF EXISTS "Public read for active emergency card via token" ON public.emergency_cards;
DROP POLICY IF EXISTS "Public read for valid non-expired tokens" ON public.shared_access_tokens;

-- Family Profiles: Owner only
DROP POLICY IF EXISTS "Users can manage own family profiles" ON public.family_profiles;
CREATE POLICY "Users can manage own family profiles"
    ON public.family_profiles FOR ALL
    USING (auth.uid() = account_owner_id)
    WITH CHECK (auth.uid() = account_owner_id);

-- Emergency Cards: Owner only for direct table queries (Zero public table access)
DROP POLICY IF EXISTS "Users can manage own emergency card" ON public.emergency_cards;
CREATE POLICY "Users can manage own emergency card"
    ON public.emergency_cards FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Shared Access Tokens: Owner only for direct table queries (Zero public table access)
DROP POLICY IF EXISTS "Users can manage own share tokens" ON public.shared_access_tokens;
CREATE POLICY "Users can manage own share tokens"
    ON public.shared_access_tokens FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 8. Hardened Token-Based RPCs (SET search_path = '')
-- ------------------------------------------------------------------------------

-- Emergency Card Public Fetch (Excludes token reflection; verified active)
CREATE OR REPLACE FUNCTION public.get_emergency_card_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    allergies JSONB,
    confirmed_medications JSONB,
    blood_group TEXT,
    critical_notes TEXT,
    is_active BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_token IS NULL OR p_token = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        ec.id,
        ec.emergency_contact_name,
        ec.emergency_contact_phone,
        ec.emergency_contact_relation,
        ec.allergies,
        ec.confirmed_medications,
        ec.blood_group,
        ec.critical_notes,
        ec.is_active,
        ec.updated_at
    FROM public.emergency_cards ec
    WHERE ec.emergency_token = p_token
      AND ec.is_active = true;
END;
$$;

-- Revoke default public execution, then grant explicitly to intended client roles
REVOKE ALL ON FUNCTION public.get_emergency_card_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_emergency_card_by_token(TEXT) TO anon, authenticated, service_role;

-- Shared Token Verification & Access (Enforces READ_ONLY; no internal ID leakage)
CREATE OR REPLACE FUNCTION public.get_public_share_by_token(p_token TEXT)
RETURNS TABLE (
    recipient_label TEXT,
    permission_level TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_record public.shared_access_tokens%ROWTYPE;
BEGIN
    IF p_token IS NULL OR p_token = '' THEN
        RETURN;
    END IF;

    SELECT * INTO v_token_record
    FROM public.shared_access_tokens
    WHERE share_token = p_token;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Reject revoked or expired shares
    IF v_token_record.is_revoked OR v_token_record.expires_at <= pg_catalog.now() THEN
        RETURN;
    END IF;

    -- Enforce that public access is strictly READ_ONLY
    IF v_token_record.permission_level NOT IN ('READ_ONLY', 'read_only') THEN
        RETURN;
    END IF;

    -- Increment view count and record last access timestamp
    UPDATE public.shared_access_tokens
    SET view_count = v_token_record.view_count + 1,
        last_accessed_at = pg_catalog.now()
    WHERE id = v_token_record.id;

    RETURN QUERY
    SELECT
        v_token_record.recipient_label,
        v_token_record.permission_level,
        v_token_record.expires_at,
        v_token_record.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_share_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_share_by_token(TEXT) TO anon, authenticated, service_role;

-- Shared Documents Retrieval (Strict READ_ONLY validation; owner-isolated)
CREATE OR REPLACE FUNCTION public.get_shared_documents_by_token(p_token TEXT)
RETURNS TABLE (
    document_id UUID,
    original_filename TEXT,
    document_type TEXT,
    created_at TIMESTAMPTZ,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token public.shared_access_tokens%ROWTYPE;
BEGIN
    IF p_token IS NULL OR p_token = '' THEN
        RETURN;
    END IF;

    SELECT * INTO v_token
    FROM public.shared_access_tokens
    WHERE share_token = p_token
      AND is_revoked = false
      AND expires_at > pg_catalog.now();

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Explicit validation: public QR sharing must strictly be READ_ONLY
    IF v_token.permission_level NOT IN ('READ_ONLY', 'read_only') THEN
        RETURN;
    END IF;

    -- Safe validation that document_ids is a JSONB array
    IF pg_catalog.jsonb_typeof(v_token.document_ids) <> 'array' THEN
        RETURN;
    END IF;

    -- Return only documents strictly owned by the token creator
    RETURN QUERY
    SELECT
        md.id AS document_id,
        md.original_filename,
        md.document_type,
        md.created_at,
        md.status
    FROM public.medical_documents md
    WHERE md.user_id = v_token.user_id
      AND md.id::text IN (
          SELECT pg_catalog.jsonb_array_elements_text(v_token.document_ids)
      );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_documents_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_documents_by_token(TEXT) TO anon, authenticated, service_role;
