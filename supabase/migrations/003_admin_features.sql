-- ============================================================================
-- Sprint 3: Admin Features — Production Migration
-- Run this on your Supabase SQL Editor
-- ============================================================================

-- 1. Extend contract_data table (idempotent — IF NOT EXISTS)
ALTER TABLE contract_data 
  ADD COLUMN IF NOT EXISTS candidate_passport_issue_date DATE,
  ADD COLUMN IF NOT EXISTS candidate_passport_issuer TEXT,
  ADD COLUMN IF NOT EXISTS candidate_place_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS candidate_gender TEXT,
  ADD COLUMN IF NOT EXISTS employer_mb TEXT,
  ADD COLUMN IF NOT EXISTS employer_director TEXT,
  ADD COLUMN IF NOT EXISTS job_description_sr TEXT,
  ADD COLUMN IF NOT EXISTS job_description_en TEXT,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS signing_date DATE,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_documents JSONB DEFAULT '{}';

-- 2. Storage: Ensure candidate-docs bucket exists and is public
-- You MUST also verify this bucket exists in Supabase Dashboard:
-- Storage > candidate-docs > should already exist
-- If it doesn't: Storage > New bucket > Name: "candidate-docs" > Check "Public bucket"

-- 3. Storage policies for generated contracts (admin can write to contracts/ path)
-- These use service_role key so they bypass RLS, but just in case:
DO $$
BEGIN
    -- Allow admins to upload to contracts/ folder inside candidate-docs
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Admin upload contracts' 
        AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Admin upload contracts" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'candidate-docs' 
                AND (storage.foldername(name))[1] = 'contracts'
                AND EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND user_type = 'admin'
                )
            );
    END IF;

    -- Allow admins to read contracts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Admin read contracts' 
        AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Admin read contracts" ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'candidate-docs' 
                AND (storage.foldername(name))[1] = 'contracts'
                AND EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND user_type = 'admin'
                )
            );
    END IF;

    -- Allow admins to update/overwrite contracts (for regeneration)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Admin update contracts' 
        AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Admin update contracts" ON storage.objects
            FOR UPDATE TO authenticated
            USING (
                bucket_id = 'candidate-docs' 
                AND (storage.foldername(name))[1] = 'contracts'
                AND EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND user_type = 'admin'
                )
            );
    END IF;
END $$;

-- 4. Verify: Check the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contract_data' 
ORDER BY ordinal_position;
