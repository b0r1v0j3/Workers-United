-- =============================================
-- E-UPRAVA INTEGRATION - DATABASE UPDATES
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add application_data column for e-Uprava form data
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS application_data JSONB DEFAULT '{}';

-- 2. Add extracted_data column to documents for OCR results
ALTER TABLE candidate_documents 
ADD COLUMN IF NOT EXISTS extracted_data JSONB DEFAULT '{}';

-- 3. Add profile validation status
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS profile_validation_status TEXT DEFAULT 'pending';
-- Values: 'pending', 'validated', 'mismatch'

-- 4. Add validation issues array
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS validation_issues JSONB DEFAULT '[]';

-- 5. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_candidates_application_data 
ON candidates USING GIN (application_data);

CREATE INDEX IF NOT EXISTS idx_candidates_validation_status 
ON candidates (profile_validation_status);

CREATE INDEX IF NOT EXISTS idx_documents_extracted_data 
ON candidate_documents USING GIN (extracted_data);

-- 6. Add comments for documentation
COMMENT ON COLUMN candidates.application_data IS 'E-Uprava application form data (personal info, family, children)';
COMMENT ON COLUMN candidates.profile_validation_status IS 'Validation status: pending, validated, mismatch';
COMMENT ON COLUMN candidates.validation_issues IS 'Array of validation issues found when comparing profile to documents';
COMMENT ON COLUMN candidate_documents.extracted_data IS 'Structured data extracted from document via OCR (name, DOB, etc)';
