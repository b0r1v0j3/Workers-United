-- Update Candidate Documents Table to match new requirements
ALTER TABLE public.candidate_documents 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'uploaded',
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Update check constraint if exists or just allow new statuses
-- Since it's a new migration, we can just ensure the column exists and has the right naming
-- We will also update the verification_status column to be compatible or just use 'status' as predominant
