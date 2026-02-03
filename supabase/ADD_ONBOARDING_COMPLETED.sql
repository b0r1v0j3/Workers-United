-- ================================================================
-- ADD ONBOARDING_COMPLETED COLUMN & SIGNATURE FIX
-- Run this in Supabase SQL Editor IMMEDIATELY
-- ================================================================

-- Add onboarding_completed column
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Ensure signature_url exists
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- ================================================================
-- DONE!
-- ================================================================
