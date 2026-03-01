-- ============================================================
-- MIGRATION: User Activity Tracking
-- Records every significant user action for debugging and
-- AI-powered daily analysis via n8n + GPT 5.3 Codex
-- ============================================================

-- 1. Create the user_activity table
CREATE TABLE IF NOT EXISTS public.user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- What happened
    action TEXT NOT NULL,           -- e.g. 'page_visit', 'profile_save', 'document_upload', 'document_verified', 'document_rejected', 'error'
    category TEXT NOT NULL,         -- e.g. 'profile', 'documents', 'payment', 'auth', 'navigation'
    
    -- Context
    details JSONB DEFAULT '{}',    -- Flexible: { page: '/profile/worker/documents', error: '...', doc_type: 'passport', ... }
    status TEXT DEFAULT 'ok',      -- 'ok', 'error', 'warning', 'blocked'
    
    -- Device info (from client)
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_category ON user_activity(category);
CREATE INDEX IF NOT EXISTS idx_user_activity_status ON user_activity(status) WHERE status != 'ok';

-- 3. RLS policies
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Users can insert their own activity
DROP POLICY IF EXISTS "Users insert own activity" ON user_activity;
CREATE POLICY "Users insert own activity" ON user_activity
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- Users can view their own activity
DROP POLICY IF EXISTS "Users view own activity" ON user_activity;
CREATE POLICY "Users view own activity" ON user_activity
    FOR SELECT USING (user_id = (select auth.uid()) OR public.is_admin());

-- Admins can view all (for Brain analysis)
DROP POLICY IF EXISTS "Admins view all activity" ON user_activity;
CREATE POLICY "Admins view all activity" ON user_activity
    FOR SELECT USING (public.is_admin());

-- Service role can insert (for server-side logging)
DROP POLICY IF EXISTS "Service can insert activity" ON user_activity;
CREATE POLICY "Service can insert activity" ON user_activity
    FOR INSERT WITH CHECK (true);

-- 4. Grants
GRANT ALL ON public.user_activity TO authenticated;
GRANT SELECT ON public.user_activity TO anon;

-- 5. Auto-cleanup: delete activity older than 90 days (run via cron)
-- This can be triggered by a Vercel cron or n8n scheduled job:
-- DELETE FROM user_activity WHERE created_at < NOW() - INTERVAL '90 days';
