-- Brain Reports Table
-- Stores weekly AI brain analysis reports for history and comparison

CREATE TABLE IF NOT EXISTS brain_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report JSONB NOT NULL,
    model TEXT NOT NULL DEFAULT 'gpt-5.2',
    findings_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick retrieval by date
CREATE INDEX idx_brain_reports_created ON brain_reports(created_at DESC);

-- RLS: Only accessible via admin client (service role)
ALTER TABLE brain_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read brain reports"
    ON brain_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.user_type = 'admin'
        )
    );
