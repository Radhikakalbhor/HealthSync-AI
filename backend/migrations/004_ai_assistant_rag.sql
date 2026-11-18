-- ==============================================================================
-- HealthSync AI — Migration 004: AI Assistant, Scoped RAG & pgvector
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Enable pgvector extension (Supabase installs to 'extensions' or 'public')
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------------------------
-- 2. Document Chunks Table (for scoped RAG retrieval)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- { filename, doc_type, date, section }
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ------------------------------------------------------------------------------
-- 3. Dynamic Vector Column & HNSW Index Resolution
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_schema text;
BEGIN
    -- Locate exact schema where pgvector is installed
    SELECT n.nspname INTO v_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';

    IF v_schema IS NULL THEN
        RAISE EXCEPTION 'pgvector extension is missing. Run: CREATE EXTENSION vector;';
    END IF;

    -- Add embedding column with schema qualification (768 dimensions for Gemini text-embedding-004)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_chunks'
          AND column_name = 'embedding'
    ) THEN
        EXECUTE format('ALTER TABLE public.document_chunks ADD COLUMN embedding %I.vector(768);', v_schema);
    END IF;

    -- Create HNSW Cosine Index with exact operator class schema qualification
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'document_chunks'
          AND indexname = 'idx_chunks_embedding_hnsw'
    ) THEN
        EXECUTE format(
            'CREATE INDEX idx_chunks_embedding_hnsw ON public.document_chunks USING hnsw (embedding %I.vector_cosine_ops);',
            v_schema
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Chat Conversations Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Medical Consultation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ------------------------------------------------------------------------------
-- 5. Chat Messages Table with Citations
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
-- 6. Hardened Cross-Patient Ownership Enforcement Triggers (SET search_path = '')
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
-- 7. Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chunks_user_doc ON public.document_chunks(user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.chat_messages(user_id);

-- ------------------------------------------------------------------------------
-- 8. Row-Level Security
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

-- Chat Messages Policies (Enforces user role restrictions AND parent conversation ownership)
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in own conversations"
    ON public.chat_messages FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Authenticated clients can strictly only post messages with role = 'user'
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

-- Explicit management policy for backend service role (inserts assistant synthesis & system messages)
DROP POLICY IF EXISTS "Service role can manage all chat messages" ON public.chat_messages;
CREATE POLICY "Service role can manage all chat messages"
    ON public.chat_messages FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
