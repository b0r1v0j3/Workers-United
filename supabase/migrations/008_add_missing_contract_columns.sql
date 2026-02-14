-- Migration: Add missing contract_data columns for document generation
-- These fields were added to the code but missing from the database schema
-- Run this in Supabase SQL Editor

ALTER TABLE contract_data
  ADD COLUMN IF NOT EXISTS employer_city TEXT,
  ADD COLUMN IF NOT EXISTS employer_founding_date TEXT,
  ADD COLUMN IF NOT EXISTS employer_apr_number TEXT,
  ADD COLUMN IF NOT EXISTS signing_city TEXT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contract_data'
  AND column_name IN ('employer_city', 'employer_founding_date', 'employer_apr_number', 'signing_city')
ORDER BY column_name;
