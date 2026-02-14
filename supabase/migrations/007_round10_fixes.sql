-- ============================================
-- Round 10 Bug Fix Migration
-- ============================================

-- 1. Add read_at column to email_queue for notification read tracking
--    The notifications API reads/updates this column but it was never created
ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add agreed_at column to signatures table
--    The signatures GET endpoint selects this column  
ALTER TABLE signatures
ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ DEFAULT NULL;
