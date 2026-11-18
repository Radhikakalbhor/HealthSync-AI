-- ==============================================================================
-- HealthSync AI — Migration 004 (Local PostgreSQL Compatibility Version)
-- Target: Standalone Local PostgreSQL (Development & CI without C pgvector binary)
--
-- IMPORTANT ARCHITECTURAL & TESTING NOTICE:
-- 1. This file is a LOCAL-ONLY TESTING COMPATIBILITY version of Migration 004.
-- 2. It is used exclusively by local database test scripts (e.g. run_local_db_tests.ps1).
-- 3. The canonical production migration (backend/migrations/004_ai_assistant_rag.sql)
--    remains completely unchanged for production Supabase deployment.
-- 4. NO system catalog tables are directly modified.
--
-- WHAT IS GENUINELY TESTED HERE:
-- [X] Creation of public.document_chunks, chat_conversations, and chat_messages tables.
-- [X] Foreign key cascading deletes to medical_documents and profiles.
-- [X] Cross-patient isolation triggers (check_document_chunk_owner, check_chat_message_conversation_owner).
-- [X] Non-vector B-tree indexes for user and conversation queries.
-- [X] Row-Level Security (RLS) activation on all 3 tables.
-- [X] Complete RLS policy rules for authenticated and service_role.
-- [X] Discretionary Access Control (DAC) grants/revokes in Migration 006 on all 17 tables.
--
-- WHAT IS EXPLICITLY NOT TESTED (REQUIRES REAL PGVECTOR BINARY / SUPABASE CLOUD / DOCKER):
-- [!] 'vector' PostgreSQL extension (CREATE EXTENSION vector;)
-- [!] Exact 768-dimension vector type constraints (vector(768))
-- [!] HNSW vector index construction (idx_chunks_embedding_hnsw)
-- [!] Cosine distance similarity operator (<=>) and KNN nearest-neighbor searches
-- [!] Semantic RAG similarity matching (match_document_chunks RPC)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Document Chunks Table (for scoped RAG retrieval)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- { filename, doc_type, date, section }
    embedding float8[] NULL,                     -- Non-vector float array storage for local schema compatibility
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ------------------------------------------------------------------------------
-- 2. Chat Conversations Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Medical Consultation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ------------------------------------------------------------------------------
-- 3. Chat Messages Table with Citations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { document_id, filename, date, snippet }
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ------------------------------------------------------------------------------
-- 4. Hardened Cross-Patient Ownership Enforcement Triggers (SET search_path = '')
-- ------------------------------------------------------------------------------

-- Ensure document chunks can only reference documents owned by the same user
CREATE OR REPLACE FUNCTION public.check_document_chunk_owner()
RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.medical_documents
        WHERE id = NEW.document_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Ownership mismatch: document_id % does not belong to user_id %',
            NEW.document_id, NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_verify_chunk_document_ownership ON public.document_chunks;
CREATE TRIGGER trg_verify_chunk_document_ownership
    BEFORE INSERT OR UPDATE ON public.document_chunks
    FOR EACH ROW
    EXECUTE FUNCTION public.check_document_chunk_owner();

-- Ensure chat messages can only be added to conversations owned by the same user
CREATE OR REPLACE FUNCTION public.check_chat_message_conversation_owner()
RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.chat_conversations
        WHERE id = NEW.conversation_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Ownership mismatch: conversation_id % does not belong to user_id %',
            NEW.conversation_id, NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_verify_chat_message_ownership ON public.chat_messages;
CREATE TRIGGER trg_verify_chat_message_ownership
    BEFORE INSERT OR UPDATE ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.check_chat_message_conversation_owner();

-- ------------------------------------------------------------------------------
-- 5. Standard Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chunks_user_doc ON public.document_chunks(user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.chat_messages(user_id);

-- ------------------------------------------------------------------------------
-- 6. Row-Level Security
-- ------------------------------------------------------------------------------
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Document Chunks Policies
DROP POLICY IF EXISTS "Users can only read own document chunks" ON public.document_chunks;
CREATE POLICY "Users can only read own document chunks"
    ON public.document_chunks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert own document chunks" ON public.document_chunks;
CREATE POLICY "Users can only insert own document chunks"
    ON public.document_chunks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete own document chunks" ON public.document_chunks;
CREATE POLICY "Users can only delete own document chunks"
    ON public.document_chunks FOR DELETE
    USING (auth.uid() = user_id);

-- Chat Conversations Policies
DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
CREATE POLICY "Users can view own conversations"
    ON public.chat_conversations FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own conversations" ON public.chat_conversations;
CREATE POLICY "Users can create own conversations"
    ON public.chat_conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.chat_conversations;
CREATE POLICY "Users can update own conversations"
    ON public.chat_conversations FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.chat_conversations;
CREATE POLICY "Users can delete own conversations"
    ON public.chat_conversations FOR DELETE
    USING (auth.uid() = user_id);

-- Chat Messages Policies
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in own conversations"
    ON public.chat_messages FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert messages into own conversations" ON public.chat_messages;
CREATE POLICY "Users can insert messages into own conversations"
    ON public.chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND role = 'user'
        AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
            WHERE c.id = chat_messages.conversation_id
              AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete messages from own conversations" ON public.chat_messages;
CREATE POLICY "Users can delete messages from own conversations"
    ON public.chat_messages FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all chat messages" ON public.chat_messages;
CREATE POLICY "Service role can manage all chat messages"
    ON public.chat_messages FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
