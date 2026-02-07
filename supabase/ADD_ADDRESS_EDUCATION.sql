-- ================================================================
-- ADD ADDRESS AND EDUCATION COLUMNS TO CANDIDATES
-- Run this in Supabase SQL Editor
-- ================================================================

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_level TEXT;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'candidates' 
AND column_name IN ('address', 'education_level');
