-- =============================================
-- ADD APPLICATION DATA COLUMN FOR E-UPRAVA
-- Run this in Supabase SQL Editor
-- =============================================

-- Add JSONB column for application data
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS application_data JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN candidates.application_data IS 'Stores e-Uprava application data including personal info, family, and children';

-- Create index for faster queries on specific fields
CREATE INDEX IF NOT EXISTS idx_candidates_application_data 
ON candidates USING GIN (application_data);
