-- ==============================================================================
-- HealthSync AI — Local PostgreSQL Compatibility Harness for Supabase Testing
-- Enables local testing of Migrations against standard PostgreSQL
-- WITHOUT connecting to Supabase cloud or installing Docker.
--
-- CLASSIFICATION OF BEHAVIORS:
--
-- [GENUINE POSTGRESQL BEHAVIORS TESTED FULLY]:
-- 1. Table DDL, column types, default values, and UUID primary keys.
-- 2. Foreign key constraints, cascading deletes, and check constraints.
-- 3. PL/pgSQL functions, triggers, and execution contexts.
-- 4. Discretionary Access Control (GRANT / REVOKE on schemas, tables, and routines).
-- 5. Row-Level Security (RLS) policies and condition evaluation.
-- 6. Atomic migration manifests, idempotency guards, and rollback scripts.
--
-- [MOCKED SUPABASE BEHAVIORS (NOT GENUINE GOTRUE / POSTGREST ENGINE)]:
-- 1. auth.users table is a mock schema, not the live Supabase GoTrue auth service.
-- 2. auth.uid(), auth.role(), and auth.jwt() extract claims from session settings
--    ('request.jwt.claim.*') rather than verifying cryptographically signed JWTs.
-- 3. Anonymous and authenticated roles are plain PostgreSQL roles without PostgREST HTTP routing.
-- ==============================================================================

-- 1. Create Supabase Auth Schema & Mock Tables
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID,
    aud VARCHAR(255) DEFAULT 'authenticated',
    role VARCHAR(255) DEFAULT 'authenticated',
    email VARCHAR(255) UNIQUE,
    encrypted_password VARCHAR(255),
    email_confirmed_at TIMESTAMPTZ DEFAULT now(),
    invited_at TIMESTAMPTZ,
    confirmation_token VARCHAR(255),
    confirmation_sent_at TIMESTAMPTZ,
    recovery_token VARCHAR(255),
    recovery_sent_at TIMESTAMPTZ,
    email_change_token_new VARCHAR(255),
    email_change VARCHAR(255),
    email_change_sent_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    is_super_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    phone TEXT DEFAULT NULL,
    phone_confirmed_at TIMESTAMPTZ,
    phone_change TEXT DEFAULT '',
    phone_change_token VARCHAR(255) DEFAULT '',
    phone_change_sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ DEFAULT now(),
    email_change_token_current VARCHAR(255) DEFAULT '',
    email_change_confirm_status SMALLINT DEFAULT 0,
    banned_until TIMESTAMPTZ,
    reauthentication_token VARCHAR(255) DEFAULT '',
    reauthentication_sent_at TIMESTAMPTZ,
    is_sso_user BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ
);

-- 2. Create Supabase Standard Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END $$;

-- 3. Create auth.uid() function mock for RLS evaluation
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Create auth.role() function mock
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
EXCEPTION WHEN OTHERS THEN
    RETURN 'authenticated';
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Create auth.jwt() function mock returning JSONB claims
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB AS $$
DECLARE
    v_sub TEXT;
    v_role TEXT;
    v_email TEXT;
BEGIN
    v_sub := current_setting('request.jwt.claim.sub', true);
    v_role := current_setting('request.jwt.claim.role', true);
    v_email := current_setting('request.jwt.claim.email', true);

    RETURN jsonb_build_object(
        'sub', v_sub,
        'role', COALESCE(NULLIF(v_role, ''), 'authenticated'),
        'email', v_email
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('role', 'authenticated');
END;
$$ LANGUAGE plpgsql STABLE;
