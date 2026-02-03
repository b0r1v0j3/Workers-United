-- ================================================================
-- ADD FIRST_NAME AND LAST_NAME TO PROFILES TABLE
-- Run this in Supabase SQL Editor
-- ================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- ================================================================
-- DONE!
-- ================================================================
