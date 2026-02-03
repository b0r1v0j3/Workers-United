-- ================================================================
-- ADD MISSING COLUMNS TO CANDIDATES TABLE
-- Run this in Supabase SQL Editor IMMEDIATELY
-- ================================================================

-- Add nationality column
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS nationality TEXT;

-- Add date_of_birth column
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add languages column (array of text)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS languages TEXT[];

-- Add current_country column
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_country TEXT;

-- Add preferred_country column  
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS preferred_country TEXT;

-- Add photo_url for biometric photo
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add diploma_url for diploma
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS diploma_url TEXT;

-- ================================================================
-- DONE! All columns added.
-- ================================================================
