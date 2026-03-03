-- AI Brain Memory Table
-- Provides the AI with persistent storage to remember learned behaviors, system bottlenecks, and user interaction rules.

CREATE TABLE IF NOT EXISTS brain_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('USER_PREFERENCE', 'SYSTEM_RULE', 'OBSERVATION', 'BOT_INSTRUCTION', 'SUMMARY')),
    content TEXT NOT NULL,
    confidence NUMERIC(3,2) DEFAULT 1.00 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying relevant facts by category quickly
CREATE INDEX IF NOT EXISTS idx_brain_memory_category ON brain_memory(category);
CREATE INDEX IF NOT EXISTS idx_brain_memory_confidence ON brain_memory(confidence DESC);

-- RLS: Only accessible via admin client (service role)
ALTER TABLE brain_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read brain memory"
    ON brain_memory FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.user_type = 'admin'
        )
    );

CREATE POLICY "Service role full access on brain_memory"
    ON brain_memory FOR ALL
    USING (auth.role() = 'service_role');
