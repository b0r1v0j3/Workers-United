-- ================================================================
-- EMPLOYER PROFILE COLUMNS MIGRATION
-- Run this in Supabase SQL Editor to add ALL employer profile columns
-- ================================================================

ALTER TABLE employers ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_registration_number TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS founded_year TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

-- DONE!
