-- ================================================================
-- Migration 006: Round 7 Bug Fixes
-- Missing RPCs, CHECK constraint mismatches, missing columns
-- ================================================================

-- ================================================================
-- 1. CREATE MISSING increment_positions_filled RPC
-- Used by: offers/route.ts accept flow — currently crashes
-- ================================================================
CREATE OR REPLACE FUNCTION increment_positions_filled(job_request_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE job_requests
    SET positions_filled = positions_filled + 1,
        updated_at = NOW()
    WHERE id = job_request_id;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 2. FIX email_queue.email_type CHECK (if exists)
-- phase6-extensions.sql creates a CHECK that only allows 9 types
-- but code uses 17+ types — all those emails silently fail
-- Solution: drop the restrictive CHECK, email_type is just Text
-- ================================================================
ALTER TABLE public.email_queue
DROP CONSTRAINT IF EXISTS email_queue_email_type_check;

-- ================================================================
-- 3. FIX employers.status CHECK to accept both cases
-- Code uses lowercase 'pending'/'verified' in several places
-- Phase6 CHECK only allows uppercase PENDING/ACTIVE/VERIFIED/etc
-- Solution: allow both cases
-- ================================================================
ALTER TABLE public.employers DROP CONSTRAINT IF EXISTS employers_status_check;
ALTER TABLE public.employers ADD CONSTRAINT employers_status_check
    CHECK (status IN (
        'PENDING', 'ACTIVE', 'VERIFIED', 'REJECTED', 'SUSPENDED',
        'pending', 'active', 'verified', 'rejected', 'suspended'
    ));

-- ================================================================
-- DONE
-- ================================================================
