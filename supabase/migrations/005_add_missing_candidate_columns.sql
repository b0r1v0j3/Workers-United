-- ================================================================
-- Migration 005: Add Missing Candidate Profile Columns
-- ProfileClient.tsx writes 20+ columns that don't exist yet.
-- Also fixes: employer status case, job_requests.description_en
-- ================================================================

-- ================================================================
-- 1. ADD MISSING COLUMNS TO candidates
-- Used by: ProfileClient.tsx handleSubmit()
-- ================================================================
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS current_country TEXT,
ADD COLUMN IF NOT EXISTS birth_country TEXT,
ADD COLUMN IF NOT EXISTS birth_city TEXT,
ADD COLUMN IF NOT EXISTS citizenship TEXT,
ADD COLUMN IF NOT EXISTS original_citizenship TEXT,
ADD COLUMN IF NOT EXISTS maiden_name TEXT,
ADD COLUMN IF NOT EXISTS father_name TEXT,
ADD COLUMN IF NOT EXISTS mother_name TEXT,
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS family_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS passport_issued_by TEXT,
ADD COLUMN IF NOT EXISTS passport_issue_date DATE,
ADD COLUMN IF NOT EXISTS passport_expiry_date DATE,
ADD COLUMN IF NOT EXISTS lives_abroad TEXT,
ADD COLUMN IF NOT EXISTS previous_visas TEXT,
ADD COLUMN IF NOT EXISTS desired_industries TEXT[] DEFAULT '{}';

-- ================================================================
-- 2. ADD MISSING COLUMNS TO job_requests
-- Used by: contracts/prepare reads description_en
-- Used by: EmployerProfileClient reads work_city
-- ================================================================
ALTER TABLE public.job_requests
ADD COLUMN IF NOT EXISTS description_en TEXT;

-- ================================================================
-- 3. ADD MISSING COLUMNS TO employers
-- prepare/route.ts reads contact_email
-- ================================================================
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- ================================================================
-- 4. FIX employer status CHECK constraint
-- EmployerProfileClient inserts status 'pending' (lowercase)
-- but original CHECK requires 'PENDING' (uppercase)
-- Solution: allow both cases
-- ================================================================
ALTER TABLE public.employers DROP CONSTRAINT IF EXISTS employers_status_check;
ALTER TABLE public.employers ADD CONSTRAINT employers_status_check 
    CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED', 'pending', 'verified', 'rejected'));

-- ================================================================
-- DONE
-- ================================================================
