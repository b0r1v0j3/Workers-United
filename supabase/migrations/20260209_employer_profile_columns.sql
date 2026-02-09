-- ================================================================
-- EMPLOYER PROFILE COLUMNS MIGRATION
-- Run this in Supabase SQL Editor to add missing employer columns
-- ================================================================

-- Add missing columns
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_registration_number TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS founded_year TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS description TEXT;

-- Change pib to TEXT to allow 9-digit tax IDs (not just 8)
ALTER TABLE employers ALTER COLUMN pib TYPE TEXT;

-- Drop old pib format constraint that limited to 8 digits
ALTER TABLE employers DROP CONSTRAINT IF EXISTS employers_pib_format;

-- DONE!
-- After running this, refresh the employer profile page and the save should work.
