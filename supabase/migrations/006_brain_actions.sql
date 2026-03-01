-- Brain Actions table — logs autonomous AI decisions and actions
CREATE TABLE IF NOT EXISTS brain_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type TEXT NOT NULL,          -- 'user_reminder', 'retry_email', 'github_issue', 'optimization', 'alert'
    description TEXT NOT NULL,          -- human-readable description of what was done
    target_user_id UUID,                -- optional: which user was affected
    target_entity TEXT,                 -- optional: 'workflow', 'deployment', 'email', 'document'
    metadata JSONB DEFAULT '{}',        -- action-specific data (email content, issue URL, etc.)
    result TEXT DEFAULT 'completed',    -- 'completed', 'failed', 'skipped', 'pending'
    error_message TEXT,                 -- if failed, why
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying recent actions and by type
CREATE INDEX IF NOT EXISTS idx_brain_actions_created_at ON brain_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_actions_type ON brain_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_brain_actions_target_user ON brain_actions(target_user_id);

-- RLS: only service role can write, admins can read
ALTER TABLE brain_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on brain_actions"
    ON brain_actions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Admins can read brain_actions"
    ON brain_actions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.user_type = 'admin'
        )
    );
