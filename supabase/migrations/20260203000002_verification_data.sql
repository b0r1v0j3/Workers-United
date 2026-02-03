-- Update Candidate Documents Table to support verification pipeline
ALTER TABLE public.candidate_documents 
ADD COLUMN IF NOT EXISTS ocr_json JSONB,
ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- Ensure statuses are correct
-- The check constraint might need updating if it was strict before
-- However, previous migration used: status IN ('pending', 'verified', 'rejected', 'manual_review')
-- I will add 'verifying' and 'uploaded' to the allowed statuses if there is a constraint.

DO $$ 
BEGIN 
    ALTER TABLE public.candidate_documents DROP CONSTRAINT IF EXISTS candidate_documents_status_check;
    ALTER TABLE public.candidate_documents ADD CONSTRAINT candidate_documents_status_check 
    CHECK (status IN ('uploaded', 'verifying', 'verified', 'rejected', 'manual_review'));
END $$;
