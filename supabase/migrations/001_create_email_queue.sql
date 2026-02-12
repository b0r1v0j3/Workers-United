-- ============================================================
-- Workers United — email_queue table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS email_queue (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type text NOT NULL,
    recipient_email text NOT NULL,
    recipient_name text,
    subject text NOT NULL,
    template_data jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    scheduled_for timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    read_at timestamptz,
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by user (notifications, dedup checks)
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);

-- Index for pending email processing (GET endpoint)
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled ON email_queue(status, scheduled_for);

-- Index for email type filtering (funnel metrics, cron dedup)
CREATE INDEX IF NOT EXISTS idx_email_queue_email_type ON email_queue(email_type);

-- Enable Row Level Security
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own notifications
CREATE POLICY "Users can read own emails" ON email_queue
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: users can update read_at on their own notifications
CREATE POLICY "Users can mark own emails as read" ON email_queue
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: service role (admin client) can do everything
-- (This is automatic with service_role key, no policy needed)
