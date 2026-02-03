-- ================================================================
-- ADD ALL MISSING COLUMNS TO CANDIDATES TABLE
-- Run this in Supabase SQL Editor IMMEDIATELY
-- ================================================================

-- Required columns that code uses:
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_country TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS preferred_country TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS preferred_job TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS languages TEXT[];
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS passport_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS diploma_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS queue_position INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS queue_joined_at TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS entry_fee_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'NEW';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ================================================================
-- DONE! All columns added.
-- ================================================================
