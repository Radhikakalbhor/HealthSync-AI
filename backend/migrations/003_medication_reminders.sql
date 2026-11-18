-- ==============================================================================
-- HealthSync AI — Migration 003: Medication Reminders & Schedules
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Medication Schedules Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medication_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.medical_documents(id) ON DELETE SET NULL,
    prescription_id UUID REFERENCES public.extracted_prescriptions(id) ON DELETE SET NULL,
    medication_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT NOT NULL DEFAULT 'ONCE_DAILY', -- ONCE_DAILY, TWICE_DAILY, THREE_TIMES_DAILY, CUSTOM
    reminder_times JSONB NOT NULL DEFAULT '["09:00"]'::jsonb, -- Array of HH:MM strings in 24h format
    timezone TEXT NOT NULL DEFAULT 'UTC',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    instructions TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    user_confirmed BOOLEAN NOT NULL DEFAULT false, -- Must be confirmed by user to activate
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ------------------------------------------------------------------------------
-- 2. Medication Reminders (Scheduled Dose Instances)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medication_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, NOTIFIED, TAKEN, SKIPPED, MISSED
    notification_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT uq_schedule_time UNIQUE (schedule_id, scheduled_for)
);

-- ------------------------------------------------------------------------------
-- 3. Medication Tracking Logs (Adherence Events — Preserved Historical Record)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.medication_schedules(id) ON DELETE SET NULL,
    reminder_id UUID REFERENCES public.medication_reminders(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('TAKEN', 'SKIPPED', 'MISSED')),
    logged_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ------------------------------------------------------------------------------
-- 4. Hardened Relational Ownership Enforcement Triggers (SET search_path = '')
-- ------------------------------------------------------------------------------

-- Ensure schedules only link to documents owned by the same user
CREATE OR REPLACE FUNCTION public.check_medication_schedule_doc_owner()
RETURNS trigger AS $$
BEGIN
    IF NEW.document_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.medical_documents
            WHERE id = NEW.document_id AND user_id = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Ownership mismatch: document_id % does not belong to user_id %',
                NEW.document_id, NEW.user_id;
        END IF;
    END IF;
    IF NEW.prescription_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.extracted_prescriptions
            WHERE id = NEW.prescription_id AND user_id = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Ownership mismatch: prescription_id % does not belong to user_id %',
                NEW.prescription_id, NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_verify_schedule_doc_ownership ON public.medication_schedules;
CREATE TRIGGER trg_verify_schedule_doc_ownership
    BEFORE INSERT OR UPDATE ON public.medication_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.check_medication_schedule_doc_owner();

-- Ensure reminders can only be created for schedules owned by the same user
CREATE OR REPLACE FUNCTION public.check_medication_reminder_schedule_owner()
RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.medication_schedules
        WHERE id = NEW.schedule_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Ownership mismatch: schedule_id % does not belong to user_id %',
            NEW.schedule_id, NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_verify_reminder_schedule_ownership ON public.medication_reminders;
CREATE TRIGGER trg_verify_reminder_schedule_ownership
    BEFORE INSERT OR UPDATE ON public.medication_reminders
    FOR EACH ROW
    EXECUTE FUNCTION public.check_medication_reminder_schedule_owner();

-- Ensure logs can only reference schedules and reminders owned by the same user
CREATE OR REPLACE FUNCTION public.check_medication_log_schedule_owner()
RETURNS trigger AS $$
BEGIN
    IF NEW.schedule_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.medication_schedules
            WHERE id = NEW.schedule_id AND user_id = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Ownership mismatch: schedule_id % does not belong to user_id %',
                NEW.schedule_id, NEW.user_id;
        END IF;
    END IF;
    IF NEW.reminder_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.medication_reminders
            WHERE id = NEW.reminder_id AND user_id = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Ownership mismatch: reminder_id % does not belong to user_id %',
                NEW.reminder_id, NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_verify_log_schedule_ownership ON public.medication_logs;
CREATE TRIGGER trg_verify_log_schedule_ownership
    BEFORE INSERT OR UPDATE ON public.medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.check_medication_log_schedule_owner();

-- ------------------------------------------------------------------------------
-- 5. Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON public.medication_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON public.medication_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_reminders_user_scheduled ON public.medication_reminders(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.medication_reminders(status);
CREATE INDEX IF NOT EXISTS idx_logs_user_logged_at ON public.medication_logs(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_logs_schedule_id ON public.medication_logs(schedule_id);

-- ------------------------------------------------------------------------------
-- 6. Row-Level Security
-- ------------------------------------------------------------------------------
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

-- Schedules
DROP POLICY IF EXISTS "Users can view own medication schedules" ON public.medication_schedules;
CREATE POLICY "Users can view own medication schedules"
    ON public.medication_schedules FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own medication schedules" ON public.medication_schedules;
CREATE POLICY "Users can create own medication schedules"
    ON public.medication_schedules FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medication schedules" ON public.medication_schedules;
CREATE POLICY "Users can update own medication schedules"
    ON public.medication_schedules FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own medication schedules" ON public.medication_schedules;
CREATE POLICY "Users can delete own medication schedules"
    ON public.medication_schedules FOR DELETE
    USING (auth.uid() = user_id);

-- Reminders
DROP POLICY IF EXISTS "Users can view own reminders" ON public.medication_reminders;
CREATE POLICY "Users can view own reminders"
    ON public.medication_reminders FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own reminders" ON public.medication_reminders;
CREATE POLICY "Users can create own reminders"
    ON public.medication_reminders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reminders" ON public.medication_reminders;
CREATE POLICY "Users can update own reminders"
    ON public.medication_reminders FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reminders" ON public.medication_reminders;
CREATE POLICY "Users can delete own reminders"
    ON public.medication_reminders FOR DELETE
    USING (auth.uid() = user_id);

-- Logs (Append-Only)
DROP POLICY IF EXISTS "Users can view own medication logs" ON public.medication_logs;
CREATE POLICY "Users can view own medication logs"
    ON public.medication_logs FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medication logs" ON public.medication_logs;
CREATE POLICY "Users can insert own medication logs"
    ON public.medication_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Guarantee log immutability against client modification or deletion
REVOKE UPDATE, DELETE ON public.medication_logs FROM authenticated, anon;
